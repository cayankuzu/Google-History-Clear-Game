import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  banConnection,
  deleteAdminScore,
  deleteSubmission,
  fetchAdminScores,
  fetchAdminSession,
  fetchAdminSubmissions,
  fetchAuditLogs,
  fetchBans,
  loginAdmin,
  logoutAdmin,
  unbanIp,
  updateAdminScore,
  updateSubmission,
} from "../services/searchApi";
import type {
  AdminScoreEntry,
  AdminSubmission,
  AuditLog,
  IpBan,
  SearchCategory,
} from "../types/game";

const categoryOptions: SearchCategory[] = [
  "absurd",
  "normal",
  "embarrassing",
  "relationship",
  "adult",
  "sad",
  "paranormal",
  "money",
  "health",
  "wholesome",
  "family",
  "crime",
  "religion",
  "betrayal",
];

type AdminTab = "searches" | "scores" | "audit" | "bans";

type AdminScreenProps = {
  onBack: () => void;
  onChanged: () => void;
};

export function AdminScreen({ onBack, onChanged }: AdminScreenProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [scores, setScores] = useState<AdminScoreEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bans, setBans] = useState<IpBan[]>([]);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<AdminTab>("searches");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] =
    useState<"all" | "seed" | "community">("all");
  const [page, setPage] = useState(0);
  const [editingSearch, setEditingSearch] = useState<AdminSubmission | null>(null);
  const [editingScore, setEditingScore] = useState<AdminScoreEntry | null>(null);

  const load = useCallback(async () => {
    const [nextSubmissions, nextScores, nextAuditLogs, nextBans] =
      await Promise.all([
        fetchAdminSubmissions(),
        fetchAdminScores(),
        fetchAuditLogs(),
        fetchBans(),
      ]);
    setSubmissions(nextSubmissions);
    setScores(nextScores);
    setAuditLogs(nextAuditLogs);
    setBans(nextBans);
  }, []);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      setMessage("");
      try {
        await action();
        await load();
        setMessage(success);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
      }
    },
    [load],
  );

  useEffect(() => {
    fetchAdminSession()
      .then(async (valid) => {
        setAuthenticated(valid);
        if (valid) await load();
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, [load]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await loginAdmin(username, password);
      setAuthenticated(true);
      setUsername("");
      setPassword("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş yapılamadı.");
    }
  };

  const remove = async (item: AdminSubmission) => {
    const question =
      item.source === "seed"
        ? `“${item.text}” sistem kaydı oyun havuzundan kaldırılsın mı?`
        : `“${item.text}” topluluk kaydı kalıcı olarak silinsin mi?`;
    if (!window.confirm(question)) return;
    await runAction(async () => {
      await deleteSubmission(item.id);
      onChanged();
    }, "Arama kaydı kaldırıldı ve değişiklik özeti oluşturuldu.");
  };

  const toggle = async (item: AdminSubmission) => {
    const action = item.status === "active" ? "gizlemek" : "yeniden yayınlamak";
    if (!window.confirm(`“${item.text}” kaydını ${action} istediğinize emin misiniz?`)) {
      return;
    }
    await runAction(async () => {
      await updateSubmission(item.id, {
        status: item.status === "active" ? "hidden" : "active",
      });
      onChanged();
    }, item.status === "active" ? "Kayıt gizlendi." : "Kayıt yeniden yayınlandı.");
  };

  const block = async (entry: {
    ip: string;
    deviceId: string;
    label: string;
  }) => {
    const reason =
      window.prompt("Engelleme nedeni:", "Spam veya içerik kurallarının ihlali")?.trim();
    if (!reason) return;
    if (
      !window.confirm(
        `${entry.label} için IP ve cihaz kimliği engellensin mi? Bu işlem aynı cihazdan yeni içerik ve skor gönderimini durdurur.`,
      )
    ) {
      return;
    }
    await runAction(
      () => banConnection(entry.ip, entry.deviceId, reason),
      "IP ve cihaz kimliği engellendi.",
    );
  };

  const saveSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSearch) return;
    if (!window.confirm("Bu içerik değişikliklerini kaydetmek istediğinize emin misiniz?")) {
      return;
    }
    await runAction(async () => {
      await updateSubmission(editingSearch.id, {
        text: editingSearch.text,
        ...(editingSearch.source === "seed"
          ? { category: editingSearch.category }
          : {}),
        status: editingSearch.status,
      });
      setEditingSearch(null);
      onChanged();
    }, "Değişiklikler kaydedildi ve değişiklik özeti oluşturuldu.");
  };

  const saveScore = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingScore) return;
    if (!window.confirm("Bu skor değişikliklerini kaydetmek istediğinize emin misiniz?")) {
      return;
    }
    await runAction(async () => {
      await updateAdminScore(editingScore.id, {
        username: editingScore.username,
        score: editingScore.score,
        title: editingScore.title,
      });
      setEditingScore(null);
    }, "Skor değişiklikleri kaydedildi.");
  };

  if (checking) {
    return (
      <main className="admin-screen screen">
        <p>Yönetici oturumu denetleniyor…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <motion.main
        className="admin-screen screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <button className="admin-back" type="button" onClick={onBack}>← Ana menü</button>
        <form className="admin-login" onSubmit={login}>
          <p className="screen-eyebrow">YÖNETİM PANELİ</p>
          <h1>Havuzu denetle.</h1>
          <label htmlFor="admin-username">Kullanıcı adı</label>
          <input
            id="admin-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="admin-password">Yönetici parolası</label>
          <div className="admin-password-field">
            <input
              id="admin-password"
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              className="password-visibility-button"
              type="button"
              aria-label={passwordVisible ? "Parolayı gizle" : "Parolayı göster"}
              aria-pressed={passwordVisible}
              title={passwordVisible ? "Parolayı gizle" : "Parolayı göster"}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.2 0 8.7 4.3 9.5 5.4a1 1 0 0 1 0 1.2 14.8 14.8 0 0 1-3.1 3.3M6.6 6.6a15.4 15.4 0 0 0-4.1 2.8 1 1 0 0 0 0 1.2C3.3 11.7 6.8 16 12 16a10 10 0 0 0 2.3-.3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 9.4a1 1 0 0 0 0 1.2C3.3 11.7 6.8 16 12 16s8.7-4.3 9.5-5.4a1 1 0 0 0 0-1.2C20.7 8.3 17.2 4 12 4S3.3 8.3 2.5 9.4Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              )}
            </button>
          </div>
          <button className="primary-button" type="submit">Giriş yap</button>
          {message ? <div className="form-notice is-error">{message}</div> : null}
        </form>
      </motion.main>
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("tr");
  const visibleSubmissions = submissions.filter((item) => {
    const sourceMatches = sourceFilter === "all" || item.source === sourceFilter;
    const queryMatches =
      !normalizedQuery ||
      item.text.toLocaleLowerCase("tr").includes(normalizedQuery) ||
      item.ip.toLocaleLowerCase("tr").includes(normalizedQuery);
    return sourceMatches && queryMatches;
  });
  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(visibleSubmissions.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedSubmissions = visibleSubmissions.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize,
  );

  return (
    <motion.main className="admin-screen screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className="admin-toolbar">
        <div>
          <p className="screen-eyebrow">YÖNETİM PANELİ</p>
          <h1>Kontrol merkezi</h1>
        </div>
        <div>
          <button type="button" onClick={onBack}>Oyuna dön</button>
          <button
            type="button"
            onClick={async () => {
              await logoutAdmin();
              setAuthenticated(false);
            }}
          >
            Çıkış yap
          </button>
        </div>
      </header>

      <section className="admin-summary">
        <span><b>{submissions.length}</b> arama</span>
        <span><b>{scores.length}</b> skor</span>
        <span><b>{auditLogs.length}</b> değişiklik</span>
        <span><b>{bans.length}</b> engelli IP</span>
      </section>

      <nav className="admin-tabs" aria-label="Yönetim bölümleri">
        {([
          ["searches", "Arama havuzu", submissions.length],
          ["scores", "Skor tablosu", scores.length],
          ["audit", "Değişiklik özeti", auditLogs.length],
          ["bans", "Engelli kişiler", bans.length],
        ] as const).map(([value, label, count]) => (
          <button
            className={tab === value ? "is-active" : ""}
            type="button"
            key={value}
            onClick={() => setTab(value)}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </nav>

      {message ? (
        <div className="admin-message" role="status">{message}</div>
      ) : null}

      {tab === "searches" ? (
        <section className="admin-list">
          <div className="admin-filters">
            <input
              type="search"
              value={query}
              placeholder="Metin veya IP ara"
              aria-label="Havuzda ara"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
            <select
              value={sourceFilter}
              aria-label="Kayıt kaynağı"
              onChange={(event) => {
                setSourceFilter(event.target.value as typeof sourceFilter);
                setPage(0);
              }}
            >
              <option value="all">Tüm kayıtlar</option>
              <option value="seed">Sistem kayıtları</option>
              <option value="community">Topluluk kayıtları</option>
            </select>
            <span>{visibleSubmissions.length} sonuç · en yeni üstte</span>
          </div>
          {pagedSubmissions.length ? pagedSubmissions.map((item) => (
            <article className={item.status === "hidden" ? "is-hidden" : ""} key={item.id}>
              {editingSearch?.id === item.id ? (
                <form className="admin-edit-form" onSubmit={saveSearch}>
                  <label>
                    Arama metni
                    <textarea
                      value={editingSearch.text}
                      minLength={4}
                      maxLength={140}
                      onChange={(event) =>
                        setEditingSearch({ ...editingSearch, text: event.target.value })
                      }
                      required
                    />
                  </label>
                  <div>
                    {editingSearch.source === "seed" ? (
                      <label>
                        Kategori
                        <select
                          value={editingSearch.category}
                          onChange={(event) =>
                            setEditingSearch({
                              ...editingSearch,
                              category: event.target.value as SearchCategory,
                            })
                          }
                        >
                          {categoryOptions.map((category) => (
                            <option value={category} key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Sınıflandırma
                        <input value="Kategorisiz" readOnly />
                      </label>
                    )}
                    <label>
                      Durum
                      <select
                        value={editingSearch.status}
                        onChange={(event) =>
                          setEditingSearch({
                            ...editingSearch,
                            status: event.target.value as "active" | "hidden",
                          })
                        }
                      >
                        <option value="active">Yayında</option>
                        <option value="hidden">Gizli</option>
                      </select>
                    </label>
                  </div>
                  <footer>
                    <button className="is-save" type="submit">Değişiklikleri kaydet</button>
                    <button type="button" onClick={() => setEditingSearch(null)}>Vazgeç</button>
                  </footer>
                </form>
              ) : (
                <>
                  <div>
                    <strong>{item.text}</strong>
                    <small>
                      {item.source === "seed" ? `Sistem kaydı · ${item.category}` : `${item.ip} · Kategorisiz`} ·{" "}
                      {new Date(item.createdAt).toLocaleString("tr-TR")}
                    </small>
                    {item.source === "community" ? (
                      <small>Cihaz: {item.deviceId || "bilinmiyor"}</small>
                    ) : null}
                  </div>
                  <div className="admin-item-actions">
                    <button type="button" onClick={() => setEditingSearch({ ...item })}>
                      Düzenle
                    </button>
                    <button type="button" onClick={() => void toggle(item)}>
                      {item.status === "active" ? "Gizle" : "Yayınla"}
                    </button>
                    {item.source === "community" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void block({
                            ip: item.ip,
                            deviceId: item.deviceId,
                            label: `“${item.text}” içeriğini gönderen kişi`,
                          })
                        }
                      >
                        Kişiyi engelle
                      </button>
                    ) : null}
                    <button className="is-destructive" type="button" onClick={() => void remove(item)}>
                      {item.source === "seed" ? "Kaldır" : "Sil"}
                    </button>
                  </div>
                </>
              )}
            </article>
          )) : <p>Bu filtreye uyan kayıt yok.</p>}
          {visibleSubmissions.length > pageSize ? (
            <nav className="admin-pagination" aria-label="Kayıt sayfaları">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                ← Önceki
              </button>
              <span>{safePage + 1} / {pageCount}</span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              >
                Sonraki →
              </button>
            </nav>
          ) : null}
        </section>
      ) : null}

      {tab === "scores" ? (
        <section className="admin-list admin-score-manager">
          <header><h2>Skor tablosu</h2><span>En yüksek puan üstte</span></header>
          {scores.length ? scores.map((score) => (
            <article key={score.id}>
              {editingScore?.id === score.id ? (
                <form className="admin-edit-form score-edit-form" onSubmit={saveScore}>
                  <div>
                    <label>
                      Kullanıcı adı
                      <input
                        value={editingScore.username}
                        minLength={3}
                        maxLength={20}
                        onChange={(event) =>
                          setEditingScore({ ...editingScore, username: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label>
                      Puan
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={editingScore.score}
                        onChange={(event) =>
                          setEditingScore({
                            ...editingScore,
                            score: Number(event.target.value),
                          })
                        }
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Unvan
                    <input
                      value={editingScore.title}
                      maxLength={50}
                      onChange={(event) =>
                        setEditingScore({ ...editingScore, title: event.target.value })
                      }
                      required
                    />
                  </label>
                  <footer>
                    <button className="is-save" type="submit">Değişiklikleri kaydet</button>
                    <button type="button" onClick={() => setEditingScore(null)}>Vazgeç</button>
                  </footer>
                </form>
              ) : (
                <>
                  <div>
                    <strong>{score.username} · {score.score} puan</strong>
                    <small>{score.title} · {score.ip} · {new Date(score.createdAt).toLocaleString("tr-TR")}</small>
                    <small>Cihaz: {score.deviceId || "bilinmiyor"}</small>
                  </div>
                  <div className="admin-item-actions">
                    <button type="button" onClick={() => setEditingScore({ ...score })}>Düzenle</button>
                    <button
                      type="button"
                      onClick={() =>
                        void block({
                          ip: score.ip,
                          deviceId: score.deviceId,
                          label: `${score.username} adlı skor sahibi`,
                        })
                      }
                    >
                      Kişiyi engelle
                    </button>
                    <button
                      className="is-destructive"
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`${score.username} skoru silinsin mi?`)) return;
                        void runAction(
                          () => deleteAdminScore(score.id),
                          "Skor silindi ve değişiklik özeti oluşturuldu.",
                        );
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </>
              )}
            </article>
          )) : <p>Henüz kaydedilmiş skor yok.</p>}
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="audit-list">
          <header><h2>Değişiklik özeti</h2><span>En yeni işlem üstte</span></header>
          {auditLogs.length ? auditLogs.map((log) => (
            <article key={log.id}>
              <span>{log.action}</span>
              <div><strong>{log.summary}</strong><small>{log.target}</small></div>
              <time>{new Date(log.createdAt).toLocaleString("tr-TR")}</time>
            </article>
          )) : <p>Henüz yönetim değişikliği yok.</p>}
        </section>
      ) : null}

      {tab === "bans" ? (
        <section className="ban-list admin-ban-manager">
          <header><h2>Engelli bağlantılar</h2><span>{bans.length} kayıt</span></header>
          {bans.length ? bans.map((ban) => (
            <article key={`${ban.ip}-${ban.deviceId}`}>
              <strong>{ban.ip}</strong>
              <p>Cihaz: {ban.deviceId || "bilinmiyor"}</p>
              <p>{ban.reason}</p>
              <small>{new Date(ban.createdAt).toLocaleString("tr-TR")}</small>
              <button
                type="button"
                onClick={() =>
                  {
                    if (!window.confirm("Bu IP ve cihaz engelini kaldırmak istediğinize emin misiniz?")) {
                      return;
                    }
                    void runAction(
                      () => unbanIp(ban.ip),
                      "IP ve cihaz engeli kaldırıldı.",
                    );
                  }
                }
              >
                Engeli kaldır
              </button>
            </article>
          )) : <p>Engellenmiş kişi yok.</p>}
        </section>
      ) : null}
    </motion.main>
  );
}
