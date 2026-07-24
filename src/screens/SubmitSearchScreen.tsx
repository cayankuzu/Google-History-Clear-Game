import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ApiError, submitCommunitySearch } from "../services/searchApi";
import type { CommunitySearch } from "../types/game";

type SubmitSearchScreenProps = {
  onBack: () => void;
  onSubmitted: (search: CommunitySearch) => void;
  pool: CommunitySearch[];
};

export function SubmitSearchScreen({
  onBack,
  onSubmitted,
  pool,
}: SubmitSearchScreenProps) {
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" | "loading" | "success" | "error"; message?: string }
  >({ type: "idle" });
  const newestPool = useMemo(
    () =>
      [...pool].sort(
        (first, second) =>
          Date.parse(second.createdAt) - Date.parse(first.createdAt),
      ),
    [pool],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status.type === "loading") return;
    setStatus({ type: "loading" });
    try {
      const created = await submitCommunitySearch({ text, website });
      onSubmitted(created);
      setText("");
      setStatus({
        type: "success",
        message: "Aramanız ortak havuza eklendi. Bir sonraki turda karşınıza çıkabilir.",
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Arama eklenemedi. Yerel içerik sunucusunun açık olduğundan emin olun.";
      setStatus({ type: "error", message });
    }
  };

  return (
    <motion.main
      className="community-screen screen"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <header className="community-header">
        <button type="button" onClick={onBack}>← Ana menü</button>
        <span>ORTAK ARAMA HAVUZU</span>
      </header>

      <div className="community-layout">
        <section className="community-card">
          <p className="screen-eyebrow">LİSTEYE EKLEME YAP</p>
          <h1>Bir sonraki oyuncuya<br />iz bırak.</h1>
          <p>
            Gerçek kişilerin özel bilgilerini, bağlantı, telefon veya e-posta
            adresi yazmayın. Eklediğiniz cümle doğrudan oyun havuzuna katılır;
            kategoriye ayrılmaz ve turlara rastgele seçilir. Yönetici gerektiğinde
            düzenleyebilir ya da kaldırabilir.
          </p>

          <form onSubmit={submit}>
            <label htmlFor="search-text">
              Arama cümlesi
              <span>{text.length}/140</span>
            </label>
            <textarea
              id="search-text"
              value={text}
              maxLength={140}
              minLength={4}
              rows={4}
              placeholder="ör. öldükten sonra arama geçmişi otomatik silinir mi"
              onChange={(event) => setText(event.target.value)}
              required
            />

            <label className="honeypot" aria-hidden="true">
              Web sitesi
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>

            <button
              className="primary-button danger-button"
              type="submit"
              disabled={status.type === "loading"}
            >
              {status.type === "loading" ? "Havuza ekleniyor…" : "Aramayı havuza ekle"}
            </button>
          </form>

          {status.message ? (
            <div className={`form-notice is-${status.type}`} role="status">
              {status.message}
            </div>
          ) : null}

          <small className="privacy-note">
            Kötüye kullanımı önlemek için bağlantı IP’si yönetim kaydında tutulur.
            IP yalnızca hız sınırı ve engelleme için kullanılır.
          </small>
        </section>

        <aside className="community-pool">
          <header>
            <div>
              <p className="screen-eyebrow">HAVUZ</p>
              <h2>En yeni aramalar</h2>
            </div>
            <b>{pool.length}</b>
          </header>
          <div>
            {newestPool.map((item, index) => (
              <article key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.text}</strong>
                  <small>{new Date(item.createdAt).toLocaleString("tr-TR")}</small>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </motion.main>
  );
}
