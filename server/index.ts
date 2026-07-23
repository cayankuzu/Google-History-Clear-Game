import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import { searchHistoryCards } from "../src/data/searchHistoryCards.js";

type Category =
  | "adult"
  | "relationship"
  | "family"
  | "crime"
  | "money"
  | "health"
  | "religion"
  | "paranormal"
  | "embarrassing"
  | "sad"
  | "betrayal"
  | "normal"
  | "wholesome"
  | "absurd";

type Submission = {
  id: string;
  text: string;
  category: Category;
  ip: string;
  deviceId: string;
  status: "active" | "hidden";
  createdAt: string;
  updatedAt: string;
};

type Ban = {
  ip: string;
  deviceId: string;
  reason: string;
  createdAt: string;
};

type Score = {
  id: string;
  username: string;
  score: number;
  title: string;
  ip: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
};

type AuditLog = {
  id: string;
  action: string;
  target: string;
  summary: string;
  createdAt: string;
};

type Database = {
  submissions: Submission[];
  bans: Ban[];
  scores: Score[];
  auditLogs: AuditLog[];
  seedOverrides: Record<
    string,
    {
      text?: string;
      category?: Category;
      status?: "active" | "hidden";
      updatedAt: string;
    }
  >;
};

const categories = new Set<Category>([
  "adult", "relationship", "family", "crime", "money", "health", "religion",
  "paranormal", "embarrassing", "sad", "betrayal", "normal", "wholesome", "absurd",
]);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const databasePath = join(root, "server", "data", "community.json");
const blobDatabasePath = "google-history-clear-game/community.json";
const port = Number(process.env.API_PORT ?? 3301);
const adminUsername = process.env.ADMIN_USERNAME ?? "zülkarneyn";
const adminPassword =
  process.env.ADMIN_PASSWORD ?? "fırındasütlaçnasılsikilir";
const sessionSecret =
  process.env.ADMIN_SESSION_SECRET ?? "local-development-secret-change-before-publish";
const trustProxy =
  process.env.TRUST_PROXY === "true" || Boolean(process.env.VERCEL);
const useBlobStorage = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN ||
  (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
);
const requestWindows = new Map<string, number[]>();
const loginWindows = new Map<string, number[]>();
const scoreWindows = new Map<string, number[]>();
const databaseMetadata = new WeakMap<
  Database,
  { etag?: string; base: Database }
>();
let writeQueue: Promise<void> = Promise.resolve();

function emptyDatabase(): Database {
  return {
    submissions: [],
    bans: [],
    scores: [],
    auditLogs: [],
    seedOverrides: {},
  };
}

function normalizeDatabase(parsed: Partial<Database>): Database {
  return {
    submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
    bans: Array.isArray(parsed.bans) ? parsed.bans : [],
    scores: Array.isArray(parsed.scores) ? parsed.scores : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    seedOverrides:
      parsed.seedOverrides && typeof parsed.seedOverrides === "object"
        ? parsed.seedOverrides
        : {},
  };
}

function cloneDatabase(database: Database): Database {
  return structuredClone(database);
}

async function readBlobDatabase() {
  const result = await get(blobDatabasePath, {
    access: "private",
    useCache: false,
  });
  if (!result || result.statusCode !== 200) {
    return { database: emptyDatabase(), etag: undefined };
  }
  const raw = await new Response(result.stream).text();
  return {
    database: normalizeDatabase(JSON.parse(raw) as Partial<Database>),
    etag: result.blob.etag,
  };
}

async function loadDatabase(): Promise<Database> {
  try {
    if (useBlobStorage) {
      const { database, etag } = await readBlobDatabase();
      databaseMetadata.set(database, {
        etag,
        base: cloneDatabase(database),
      });
      return database;
    }

    const raw = await readFile(databasePath, "utf8");
    return normalizeDatabase(JSON.parse(raw) as Partial<Database>);
  } catch {
    return emptyDatabase();
  }
}

function publicPool(database: Database) {
  const seedItems = searchHistoryCards.flatMap((card, index) => {
    const override = database.seedOverrides[card.id];
    if (override?.status === "hidden") return [];
    return [{
      id: `seed-${card.id}`,
      text: override?.text ?? card.text,
      category: override?.category ?? card.categories[0] ?? "normal",
      createdAt: new Date(
        Date.UTC(2026, 5, 1, 12, 0, 0) + index * 1000,
      ).toISOString(),
    }];
  });
  const communityItems = database.submissions
    .filter((item) => item.status === "active")
    .map(({ id, text, category, createdAt }) => ({ id, text, category, createdAt }));
  return [...seedItems, ...communityItems].sort(
    (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
  );
}

function adminPool(database: Database) {
  const seedItems = searchHistoryCards.map((card, index) => {
    const override = database.seedOverrides[card.id];
    return {
      id: `seed-${card.id}`,
      text: override?.text ?? card.text,
      category: override?.category ?? card.categories[0] ?? "normal",
      ip: "sistem",
      deviceId: "sistem",
      source: "seed" as const,
      status: override?.status ?? "active",
      createdAt: new Date(
        Date.UTC(2026, 5, 1, 12, 0, 0) + index * 1000,
      ).toISOString(),
      updatedAt:
        override?.updatedAt ??
        new Date(Date.UTC(2026, 5, 1, 12, 0, 0) + index * 1000).toISOString(),
    };
  });
  const communityItems = database.submissions.map((item) => ({
    ...item,
    source: "community" as const,
  }));
  return [...communityItems, ...seedItems].sort(
    (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
  );
}

function recordAudit(
  database: Database,
  action: string,
  target: string,
  summary: string,
) {
  database.auditLogs.unshift({
    id: randomUUID(),
    action,
    target,
    summary,
    createdAt: new Date().toISOString(),
  });
  database.auditLogs = database.auditLogs.slice(0, 500);
}

function mergeRecords<T>(
  base: T[],
  desired: T[],
  latest: T[],
  key: (item: T) => string,
) {
  const baseByKey = new Map(base.map((item) => [key(item), item]));
  const desiredByKey = new Map(desired.map((item) => [key(item), item]));
  const mergedByKey = new Map(latest.map((item) => [key(item), item]));

  baseByKey.forEach((baseItem, itemKey) => {
    const desiredItem = desiredByKey.get(itemKey);
    if (!desiredItem) {
      mergedByKey.delete(itemKey);
      return;
    }
    if (JSON.stringify(desiredItem) !== JSON.stringify(baseItem)) {
      mergedByKey.set(itemKey, desiredItem);
    }
  });

  desiredByKey.forEach((desiredItem, itemKey) => {
    if (!baseByKey.has(itemKey)) mergedByKey.set(itemKey, desiredItem);
  });

  return [...mergedByKey.values()];
}

function mergeDatabases(
  base: Database,
  desired: Database,
  latest: Database,
): Database {
  const seedOverrides = { ...latest.seedOverrides };
  Object.keys(base.seedOverrides).forEach((seedId) => {
    if (!(seedId in desired.seedOverrides)) delete seedOverrides[seedId];
  });
  Object.entries(desired.seedOverrides).forEach(([seedId, override]) => {
    if (
      !(seedId in base.seedOverrides) ||
      JSON.stringify(override) !== JSON.stringify(base.seedOverrides[seedId])
    ) {
      seedOverrides[seedId] = override;
    }
  });

  return {
    submissions: mergeRecords(
      base.submissions,
      desired.submissions,
      latest.submissions,
      (item) => item.id,
    ),
    bans: mergeRecords(
      base.bans,
      desired.bans,
      latest.bans,
      (item) => `${item.ip}\u0000${item.deviceId}`,
    ),
    scores: mergeRecords(
      base.scores,
      desired.scores,
      latest.scores,
      (item) => item.id,
    ),
    auditLogs: mergeRecords(
      base.auditLogs,
      desired.auditLogs,
      latest.auditLogs,
      (item) => item.id,
    )
      .sort(
        (first, second) =>
          Date.parse(second.createdAt) - Date.parse(first.createdAt),
      )
      .slice(0, 500),
    seedOverrides,
  };
}

async function saveBlobDatabase(database: Database) {
  const metadata = databaseMetadata.get(database);
  let base = metadata?.base ?? emptyDatabase();
  let candidate = cloneDatabase(database);
  let etag = metadata?.etag;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await put(
        blobDatabasePath,
        JSON.stringify(candidate),
        {
          access: "private",
          allowOverwrite: true,
          cacheControlMaxAge: 60,
          contentType: "application/json; charset=utf-8",
          ifMatch: etag,
        },
      );
      databaseMetadata.set(database, {
        etag: result.etag,
        base: cloneDatabase(candidate),
      });
      return;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt === 3) {
        throw error;
      }
      const latest = await readBlobDatabase();
      candidate = mergeDatabases(base, candidate, latest.database);
      base = latest.database;
      etag = latest.etag;
    }
  }
}

async function saveDatabase(database: Database) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    if (useBlobStorage) {
      await saveBlobDatabase(database);
      return;
    }

    await mkdir(dirname(databasePath), { recursive: true });
    const temporaryPath = `${databasePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8");
    await rename(temporaryPath, databasePath);
  });
  return writeQueue;
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(JSON.stringify(value));
}

function clientIp(request: IncomingMessage) {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
    if (first?.trim()) return first.trim().slice(0, 80);
  }
  return (request.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "").slice(0, 80);
}

function clientDeviceId(request: IncomingMessage) {
  const value = request.headers["x-device-id"];
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    typeof candidate === "string" &&
    /^[a-zA-Z0-9._-]{8,96}$/.test(candidate)
  ) {
    return candidate;
  }
  return "device-unknown";
}

function isBanned(database: Database, ip: string, deviceId: string) {
  return database.bans.some(
    (ban) =>
      ban.ip === ip ||
      (ban.deviceId && deviceId !== "device-unknown" && ban.deviceId === deviceId),
  );
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 8_192) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function canonicalText(value: string) {
  return normalizeText(value)
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i")
    .replace(/[^a-z0-9çğıöşü*+]/gi, "");
}

function validateText(value: unknown) {
  if (typeof value !== "string") return "Bir arama cümlesi yazmalısınız.";
  const normalized = normalizeText(value);
  if (normalized.length < 4) return "Arama en az 4 karakter olmalı.";
  if (normalized.length > 140) return "Arama en fazla 140 karakter olabilir.";
  if (/https?:\/\/|www\./i.test(normalized)) return "Bağlantı içeren kayıtlar kabul edilmiyor.";
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(normalized)) return "E-posta adresi paylaşmayın.";
  if (/(?:\+?90|0)?5\d(?:[\s.-]?\d){8}\b/.test(normalized)) {
    return "Telefon numarası paylaşmayın.";
  }
  if (/(.)\1{9,}/u.test(normalized)) return "Aynı karakteri art arda çok fazla kullanmayın.";
  const meaningful = normalized.replace(/[^a-zçğıöşü0-9]/gi, "");
  if (meaningful.length < 3) return "Daha anlamlı bir arama cümlesi yazın.";
  return null;
}

function hasValidSession(request: IncomingMessage) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("history_admin="))
    ?.slice("history_admin=".length);
  if (!cookie) return false;
  const [expiresRaw, signature] = cookie.split(".");
  const expires = Number(expiresRaw);
  if (!expires || expires < Date.now() || !signature) return false;
  const expected = createHmac("sha256", sessionSecret).update(expiresRaw).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireAdmin(request: IncomingMessage, response: ServerResponse) {
  if (hasValidSession(request)) return true;
  sendJson(response, 401, { error: "Yönetici oturumu gerekli." });
  return false;
}

function issueSession(response: ServerResponse) {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  const signature = createHmac("sha256", sessionSecret).update(expires).digest("hex");
  const secure = process.env.VERCEL ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `history_admin=${expires}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`,
  );
}

function rateLimit(ip: string) {
  const now = Date.now();
  const recent = (requestWindows.get(ip) ?? []).filter((time) => now - time < 10 * 60_000);
  if (recent.length >= 5) return false;
  recent.push(now);
  requestWindows.set(ip, recent);
  return true;
}

function loginRateLimit(ip: string) {
  const now = Date.now();
  const recent = (loginWindows.get(ip) ?? []).filter(
    (time) => now - time < 15 * 60_000,
  );
  if (recent.length >= 8) return false;
  recent.push(now);
  loginWindows.set(ip, recent);
  return true;
}

function scoreRateLimit(ip: string) {
  const now = Date.now();
  const recent = (scoreWindows.get(ip) ?? []).filter(
    (time) => now - time < 60 * 60_000,
  );
  if (recent.length >= 10) return false;
  recent.push(now);
  scoreWindows.set(ip, recent);
  return true;
}

function safeEqual(supplied: string, expected: string) {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

function validateUsername(value: unknown) {
  if (typeof value !== "string") return "Kullanıcı adı gerekli.";
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 20) {
    return "Kullanıcı adı 3–20 karakter olmalı.";
  }
  if (!/^[\p{L}\p{N}_.-]+$/u.test(normalized)) {
    return "Yalnızca harf, rakam, nokta, tire ve alt çizgi kullanın.";
  }
  return null;
}

function categoryFrom(value: unknown): Category {
  return typeof value === "string" && categories.has(value as Category)
    ? value as Category
    : "absurd";
}

function matchPath(pathname: string, prefix: string) {
  return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : null;
}

export async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

  try {
    if (method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/api/searches") {
      const database = await loadDatabase();
      sendJson(response, 200, publicPool(database));
      return;
    }

    if (method === "GET" && pathname === "/api/scores") {
      const database = await loadDatabase();
      const ascending = url.searchParams.get("order") === "asc";
      const sorted = [...database.scores].sort((first, second) => {
        const difference = first.score - second.score;
        return ascending ? difference : -difference;
      });
      sendJson(
        response,
        200,
        sorted.map(({ id, username, score, title, createdAt }) => ({
          id,
          username,
          score,
          title,
          createdAt,
        })),
      );
      return;
    }

    if (method === "POST" && pathname === "/api/scores") {
      const ip = clientIp(request);
      const deviceId = clientDeviceId(request);
      const database = await loadDatabase();
      if (isBanned(database, ip, deviceId)) {
        sendJson(response, 403, {
          code: "BANNED",
          error: "Bu bağlantıdan skor gönderimi durduruldu.",
        });
        return;
      }
      const body = await readBody(request);
      const usernameError = validateUsername(body.username);
      if (usernameError) {
        sendJson(response, 400, { error: usernameError });
        return;
      }
      const score = Number(body.score);
      const title =
        typeof body.title === "string" ? body.title.trim().slice(0, 50) : "";
      if (!Number.isInteger(score) || score < 0 || score > 1000 || !title) {
        sendJson(response, 400, { error: "Geçersiz skor verisi." });
        return;
      }
      if (!scoreRateLimit(ip)) {
        sendJson(response, 429, {
          error: "Çok fazla skor gönderdiniz. Daha sonra yeniden deneyin.",
        });
        return;
      }
      const now = new Date().toISOString();
      const entry: Score = {
        id: randomUUID(),
        username: String(body.username).trim(),
        score,
        title,
        ip,
        deviceId,
        createdAt: now,
        updatedAt: now,
      };
      database.scores.push(entry);
      recordAudit(
        database,
        "score.create",
        entry.id,
        `${entry.username}, ${entry.score} puanla liderlik tablosuna eklendi.`,
      );
      await saveDatabase(database);
      const sorted = [...database.scores].sort(
        (first, second) => second.score - first.score,
      );
      const rank = sorted.findIndex((item) => item.id === entry.id) + 1;
      sendJson(response, 201, {
        entry: {
          id: entry.id,
          username: entry.username,
          score: entry.score,
          title: entry.title,
          createdAt: entry.createdAt,
        },
        rank,
        total: sorted.length,
      });
      return;
    }

    if (method === "POST" && pathname === "/api/searches") {
      const ip = clientIp(request);
      const deviceId = clientDeviceId(request);
      const database = await loadDatabase();
      if (isBanned(database, ip, deviceId)) {
        sendJson(response, 403, {
          code: "BANNED",
          error: "Bu bağlantıdan yeni arama eklenmesi yönetici tarafından durduruldu.",
        });
        return;
      }
      const body = await readBody(request);
      if (typeof body.website === "string" && body.website.length) {
        sendJson(response, 201, { ok: true });
        return;
      }
      const validationError = validateText(body.text);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }
      const text = normalizeText(String(body.text));
      const normalized = canonicalText(text);
      if (
        publicPool(database).some(
          (item) => canonicalText(item.text) === normalized,
        )
      ) {
        sendJson(response, 409, { error: "Bu arama havuzda zaten var." });
        return;
      }
      const lastDayCount = database.submissions.filter(
        (item) => item.ip === ip && Date.now() - Date.parse(item.createdAt) < 86_400_000,
      ).length;
      if (!rateLimit(ip) || lastDayCount >= 20) {
        sendJson(response, 429, {
          error: "Çok hızlı gönderim yaptınız. Bir süre sonra yeniden deneyin.",
        });
        return;
      }
      const now = new Date().toISOString();
      const submission: Submission = {
        id: randomUUID(),
        text,
        category: categoryFrom(body.category),
        ip,
        deviceId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      database.submissions.unshift(submission);
      recordAudit(
        database,
        "search.create",
        submission.id,
        `Topluluk havuzuna “${submission.text}” eklendi.`,
      );
      await saveDatabase(database);
      sendJson(response, 201, {
        id: submission.id,
        text: submission.text,
        category: submission.category,
        createdAt: submission.createdAt,
      });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/login") {
      const ip = clientIp(request);
      if (!loginRateLimit(ip)) {
        sendJson(response, 429, {
          error: "Çok fazla yönetici giriş denemesi. Bir süre sonra yeniden deneyin.",
        });
        return;
      }
      const body = await readBody(request);
      const suppliedUsername =
        typeof body.username === "string" ? body.username : "";
      const supplied = typeof body.password === "string" ? body.password : "";
      const valid =
        safeEqual(suppliedUsername, adminUsername) &&
        safeEqual(supplied, adminPassword);
      if (!valid) {
        sendJson(response, 401, { error: "Kullanıcı adı veya parola hatalı." });
        return;
      }
      issueSession(response);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/logout") {
      response.setHeader(
        "Set-Cookie",
        "history_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/api/admin/session") {
      sendJson(response, hasValidSession(request) ? 200 : 401, {
        authenticated: hasValidSession(request),
      });
      return;
    }

    if (pathname.startsWith("/api/admin/") && !requireAdmin(request, response)) return;

    if (method === "GET" && pathname === "/api/admin/searches") {
      const database = await loadDatabase();
      sendJson(response, 200, adminPool(database));
      return;
    }

    if (method === "GET" && pathname === "/api/admin/bans") {
      const database = await loadDatabase();
      sendJson(response, 200, database.bans);
      return;
    }

    if (method === "GET" && pathname === "/api/admin/scores") {
      const database = await loadDatabase();
      sendJson(
        response,
        200,
        [...database.scores].sort((first, second) => second.score - first.score),
      );
      return;
    }

    if (method === "GET" && pathname === "/api/admin/audit") {
      const database = await loadDatabase();
      sendJson(response, 200, database.auditLogs);
      return;
    }

    const scoreId = matchPath(pathname, "/api/admin/scores/");
    if (scoreId && method === "PATCH") {
      const body = await readBody(request);
      const database = await loadDatabase();
      const entry = database.scores.find((item) => item.id === scoreId);
      if (!entry) {
        sendJson(response, 404, { error: "Skor bulunamadı." });
        return;
      }
      if (body.username !== undefined) {
        const usernameError = validateUsername(body.username);
        if (usernameError) {
          sendJson(response, 400, { error: usernameError });
          return;
        }
        entry.username = String(body.username).trim();
      }
      if (body.score !== undefined) {
        const score = Number(body.score);
        if (!Number.isInteger(score) || score < 0 || score > 1000) {
          sendJson(response, 400, { error: "Skor 0–1000 arasında olmalı." });
          return;
        }
        entry.score = score;
      }
      if (typeof body.title === "string" && body.title.trim()) {
        entry.title = body.title.trim().slice(0, 50);
      }
      entry.updatedAt = new Date().toISOString();
      recordAudit(
        database,
        "score.update",
        entry.id,
        `${entry.username} skoru ${entry.score} puan olarak kaydedildi.`,
      );
      await saveDatabase(database);
      sendJson(response, 200, entry);
      return;
    }

    if (scoreId && method === "DELETE") {
      const database = await loadDatabase();
      const entry = database.scores.find((item) => item.id === scoreId);
      if (!entry) {
        sendJson(response, 404, { error: "Skor bulunamadı." });
        return;
      }
      database.scores = database.scores.filter((item) => item.id !== scoreId);
      recordAudit(
        database,
        "score.delete",
        entry.id,
        `${entry.username} kullanıcısının ${entry.score} puanlık skoru silindi.`,
      );
      await saveDatabase(database);
      sendJson(response, 200, { ok: true });
      return;
    }

    const submissionId = matchPath(pathname, "/api/admin/searches/");
    if (submissionId && method === "PATCH") {
      const body = await readBody(request);
      const database = await loadDatabase();
      if (submissionId.startsWith("seed-")) {
        const seedId = submissionId.slice("seed-".length);
        const seedCard = searchHistoryCards.find((card) => card.id === seedId);
        if (!seedCard) {
          sendJson(response, 404, { error: "Sistem kaydı bulunamadı." });
          return;
        }
        const current = database.seedOverrides[seedId] ?? {
          updatedAt: new Date().toISOString(),
        };
        if (body.text !== undefined) {
          const validationError = validateText(body.text);
          if (validationError) {
            sendJson(response, 400, { error: validationError });
            return;
          }
          current.text = normalizeText(String(body.text));
        }
        if (body.status === "active" || body.status === "hidden") {
          current.status = body.status;
        }
        if (body.category !== undefined) current.category = categoryFrom(body.category);
        current.updatedAt = new Date().toISOString();
        database.seedOverrides[seedId] = current;
        recordAudit(
          database,
          "search.update",
          submissionId,
          `Sistem kaydı “${current.text ?? seedCard.text}” olarak kaydedildi.`,
        );
        await saveDatabase(database);
        sendJson(
          response,
          200,
          adminPool(database).find((item) => item.id === submissionId),
        );
        return;
      }
      const submission = database.submissions.find((item) => item.id === submissionId);
      if (!submission) {
        sendJson(response, 404, { error: "Kayıt bulunamadı." });
        return;
      }
      if (body.text !== undefined) {
        const validationError = validateText(body.text);
        if (validationError) {
          sendJson(response, 400, { error: validationError });
          return;
        }
        submission.text = normalizeText(String(body.text));
      }
      if (body.status === "active" || body.status === "hidden") {
        submission.status = body.status;
      }
      if (body.category !== undefined) submission.category = categoryFrom(body.category);
      submission.updatedAt = new Date().toISOString();
      recordAudit(
        database,
        "search.update",
        submission.id,
        `Topluluk kaydı “${submission.text}” olarak kaydedildi.`,
      );
      await saveDatabase(database);
      sendJson(response, 200, submission);
      return;
    }

    if (submissionId && method === "DELETE") {
      const database = await loadDatabase();
      if (submissionId.startsWith("seed-")) {
        const seedId = submissionId.slice("seed-".length);
        const seedCard = searchHistoryCards.find((card) => card.id === seedId);
        if (!seedCard) {
          sendJson(response, 404, { error: "Sistem kaydı bulunamadı." });
          return;
        }
        database.seedOverrides[seedId] = {
          ...database.seedOverrides[seedId],
          status: "hidden",
          updatedAt: new Date().toISOString(),
        };
        recordAudit(
          database,
          "search.hide",
          submissionId,
          `Sistem kaydı “${seedCard.text}” havuzdan kaldırıldı.`,
        );
        await saveDatabase(database);
        sendJson(response, 200, { ok: true });
        return;
      }
      const before = database.submissions.length;
      database.submissions = database.submissions.filter((item) => item.id !== submissionId);
      if (database.submissions.length === before) {
        sendJson(response, 404, { error: "Kayıt bulunamadı." });
        return;
      }
      recordAudit(
        database,
        "search.delete",
        submissionId,
        "Topluluk kaydı kalıcı olarak silindi.",
      );
      await saveDatabase(database);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/bans") {
      const body = await readBody(request);
      const ip = typeof body.ip === "string" ? body.ip.trim().slice(0, 80) : "";
      const deviceId =
        typeof body.deviceId === "string"
          ? body.deviceId.trim().slice(0, 96)
          : "";
      const reason =
        typeof body.reason === "string"
          ? body.reason.trim().slice(0, 180)
          : "İçerik kurallarının ihlali";
      if (!ip && !deviceId) {
        sendJson(response, 400, { error: "IP veya cihaz kimliği gerekli." });
        return;
      }
      const database = await loadDatabase();
      if (
        !database.bans.some(
          (ban) =>
            (ip && ban.ip === ip) ||
            (deviceId && ban.deviceId === deviceId),
        )
      ) {
        database.bans.unshift({
          ip: ip || "bilinmiyor",
          deviceId: deviceId || "device-unknown",
          reason,
          createdAt: new Date().toISOString(),
        });
        recordAudit(
          database,
          "connection.ban",
          `${ip || "IP yok"} / ${deviceId || "cihaz yok"}`,
          `${ip || "Bilinmeyen IP"} ve ilişkili cihaz engellendi: ${reason}`,
        );
        await saveDatabase(database);
      }
      sendJson(response, 200, { ok: true });
      return;
    }

    const bannedIp = matchPath(pathname, "/api/admin/bans/");
    if (bannedIp && method === "DELETE") {
      const database = await loadDatabase();
      database.bans = database.bans.filter((ban) => ban.ip !== bannedIp);
      recordAudit(
        database,
        "connection.unban",
        bannedIp,
        `${bannedIp} engeli kaldırıldı.`,
      );
      await saveDatabase(database);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Bulunamadı." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "PAYLOAD_TOO_LARGE") {
      sendJson(response, 413, { error: "Gönderi sınırı aşıldı." });
      return;
    }
    if (message === "INVALID_JSON") {
      sendJson(response, 400, { error: "Geçersiz istek." });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "Sunucu isteği tamamlayamadı." });
  }
}

const isMainModule =
  Boolean(process.argv[1]) &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const server = createServer(handleApiRequest);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Yerel içerik API'si http://127.0.0.1:${port} adresinde hazır.`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`Yerel yönetici: ${adminUsername}`);
    }
  });
}
