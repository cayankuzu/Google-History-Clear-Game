import type {
  AdminSubmission,
  AdminScoreEntry,
  AuditLog,
  CommunitySearch,
  IpBan,
  SearchCategory,
  ScoreEntry,
  ScoreSubmissionResult,
} from "../types/game";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function deviceId() {
  try {
    const stored = localStorage.getItem("son33-device-id");
    if (stored) return stored;
    const created =
      globalThis.crypto?.randomUUID?.() ??
      `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("son33-device-id", created);
    return created;
  } catch {
    return "device-storage-unavailable";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Device-ID": deviceId(),
      ...options?.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      body.error ?? "İstek tamamlanamadı.",
      response.status,
      body.code,
    );
  }
  return body as T;
}

export function fetchCommunitySearches() {
  return request<CommunitySearch[]>("/api/searches");
}

export function submitCommunitySearch(input: {
  text: string;
  category: SearchCategory;
  website?: string;
}) {
  return request<CommunitySearch>("/api/searches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAdminSession() {
  try {
    await request<{ authenticated: true }>("/api/admin/session");
    return true;
  } catch {
    return false;
  }
}

export function loginAdmin(username: string, password: string) {
  return request<{ ok: true }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutAdmin() {
  return request<{ ok: true }>("/api/admin/logout", { method: "POST" });
}

export function fetchAdminSubmissions() {
  return request<AdminSubmission[]>("/api/admin/searches");
}

export function fetchBans() {
  return request<IpBan[]>("/api/admin/bans");
}

export function updateSubmission(
  id: string,
  input: Partial<Pick<AdminSubmission, "text" | "category" | "status">>,
) {
  return request<AdminSubmission>(`/api/admin/searches/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSubmission(id: string) {
  return request<{ ok: true }>(`/api/admin/searches/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function banConnection(ip: string, deviceIdValue: string, reason: string) {
  return request<{ ok: true }>("/api/admin/bans", {
    method: "POST",
    body: JSON.stringify({ ip, deviceId: deviceIdValue, reason }),
  });
}

export function unbanIp(ip: string) {
  return request<{ ok: true }>(`/api/admin/bans/${encodeURIComponent(ip)}`, {
    method: "DELETE",
  });
}

export function fetchScores(order: "asc" | "desc" = "desc") {
  return request<ScoreEntry[]>(`/api/scores?order=${order}`);
}

export function submitScore(input: {
  username: string;
  score: number;
  title: string;
}) {
  return request<ScoreSubmissionResult>("/api/scores", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAdminScores() {
  return request<AdminScoreEntry[]>("/api/admin/scores");
}

export function updateAdminScore(
  id: string,
  input: Partial<Pick<AdminScoreEntry, "username" | "score" | "title">>,
) {
  return request<AdminScoreEntry>(`/api/admin/scores/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminScore(id: string) {
  return request<{ ok: true }>(`/api/admin/scores/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function fetchAuditLogs() {
  return request<AuditLog[]>("/api/admin/audit");
}
