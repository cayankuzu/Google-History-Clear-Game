import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SettingsBar } from "../components/SettingsBar";
import {
  ROUND_CARD_COUNT,
  ROUND_DURATION_SECONDS,
} from "../constants/game";
import type {
  CommunitySearch,
  GameSettings,
  ScoreEntry,
} from "../types/game";

type StartScreenProps = {
  settings: GameSettings;
  bestScore: number;
  returningPlayer: boolean;
  pool: CommunitySearch[];
  scores: ScoreEntry[];
  onSettingsChange: (settings: GameSettings) => void;
  onStart: (skipIntro: boolean) => void;
  onSubmit: () => void;
  onAdmin: () => void;
};

export function StartScreen({
  settings,
  bestScore,
  returningPlayer,
  pool,
  scores,
  onSettingsChange,
  onStart,
  onSubmit,
  onAdmin,
}: StartScreenProps) {
  const [panel, setPanel] = useState<"pool" | "scores">("pool");
  const [scoreOrder, setScoreOrder] = useState<"desc" | "asc">("desc");
  const orderedPool = useMemo(
    () =>
      [...pool].sort(
        (first, second) =>
          Date.parse(second.createdAt) - Date.parse(first.createdAt),
      ),
    [pool],
  );
  const orderedScores = useMemo(
    () =>
      [...scores].sort((first, second) =>
        scoreOrder === "desc"
          ? second.score - first.score
          : first.score - second.score,
      ),
    [scoreOrder, scores],
  );

  return (
    <motion.main
      className="start-screen screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="start-noise" aria-hidden="true" />
      <header className="start-topline">
        <button
          className="stealth-admin-button"
          type="button"
          onClick={onAdmin}
          aria-label="Yönetim panelini aç"
        />
        <span>ÖLÜM SONRASI MAHREMİYET PROTOKOLÜ</span>
      </header>

      <section className="start-copy">
        <p className="screen-eyebrow">
          {ROUND_DURATION_SECONDS} SANİYE · {ROUND_CARD_COUNT} ARAMA · TEK ŞANS
        </p>
        <h1>
          SON
          <span>{ROUND_DURATION_SECONDS}</span>
          SANİYE
        </h1>
        <p className="start-lead">
          Öleceğin kesin. İtibarını korumak için {ROUND_DURATION_SECONDS} saniyen var.
          <strong>Geçmişini sil, geleceğini garanti et.</strong>
        </p>

        <div className="start-actions">
          <button
            className="primary-button danger-button"
            type="button"
            onClick={() => onStart(false)}
          >
            <span>Oyuna gir</span>
            <b aria-hidden="true">↗</b>
          </button>
          <button className="secondary-button" type="button" onClick={onSubmit}>
            Listeye arama ekle
          </button>
          {returningPlayer ? (
            <button
              className="text-button"
              type="button"
              onClick={() => onStart(true)}
            >
              Girişi atla, telefona uzan
            </button>
          ) : null}
        </div>

        <div className="control-hint" aria-label="Oyun kontrolleri">
          <span><kbd>←</kbd> satırı sola sürükle · sil</span>
          <span><kbd>↕</kbd> listede yukarı aşağı gezin</span>
        </div>
      </section>

      <aside className="start-meta start-data-panel">
        <nav className="start-panel-tabs" aria-label="Başlangıç listeleri">
          <button
            className={panel === "pool" ? "is-active" : ""}
            type="button"
            onClick={() => setPanel("pool")}
          >
            Havuz <span>{pool.length}</span>
          </button>
          <button
            className={panel === "scores" ? "is-active" : ""}
            type="button"
            onClick={() => setPanel("scores")}
          >
            Skorlar <span>{scores.length}</span>
          </button>
        </nav>

        {panel === "pool" ? (
          <div className="start-pool-list">
            <header>
              <small>EN YENİ ARAMALAR</small>
              <button
                className="secondary-button list-add-button"
                type="button"
                onClick={onSubmit}
              >
                Listeye arama ekle
              </button>
            </header>
            {orderedPool.map((item) => (
              <article key={item.id}>
                <strong>{item.text}</strong>
                <small>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="start-score-list">
            <header>
              <small>EN İYİ KİŞİSEL PUAN: {bestScore}</small>
              <div>
                <button
                  className={scoreOrder === "desc" ? "is-active" : ""}
                  type="button"
                  onClick={() => setScoreOrder("desc")}
                >
                  İyiden kötüye
                </button>
                <button
                  className={scoreOrder === "asc" ? "is-active" : ""}
                  type="button"
                  onClick={() => setScoreOrder("asc")}
                >
                  Kötüden iyiye
                </button>
              </div>
            </header>
            {orderedScores.length ? orderedScores.map((item, index) => (
              <article key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.username}</strong><small>{item.title}</small></div>
                <b>{item.score}</b>
              </article>
            )) : <p>Henüz liderlik skoru yok.</p>}
          </div>
        )}
      </aside>

      <SettingsBar settings={settings} onChange={onSettingsChange} />
    </motion.main>
  );
}
