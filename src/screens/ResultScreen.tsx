import { useState } from "react";
import { motion } from "framer-motion";
import { ApiError, submitScore } from "../services/searchApi";
import {
  ROUND_CARD_COUNT,
  ROUND_DURATION_SECONDS,
} from "../constants/game";
import type {
  EndingResult,
  GameResult,
  ScoreSubmissionResult,
} from "../types/game";

type ResultScreenProps = {
  result: GameResult;
  ending: EndingResult;
  onReplay: () => void;
  onMenu: () => void;
  onScoreSubmitted: () => void | Promise<void>;
};

export function ResultScreen({
  ending,
  onReplay,
  onMenu,
  onScoreSubmitted,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");
  const [scoreState, setScoreState] = useState<
    | { type: "idle" | "loading" | "error"; message?: string }
    | { type: "success"; result: ScoreSubmissionResult }
  >({ type: "idle" });
  const { breakdown } = ending;
  const correctDecisions = breakdown.goodKept + breakdown.badDeleted;
  const wrongDecisions = breakdown.goodDeleted + breakdown.badRemaining;

  const copyResult = async () => {
    const text = [
      `SON ${ROUND_DURATION_SECONDS} SANİYE`,
      `Unvanım: ${ending.title}`,
      `İtibar puanım: ${ending.score}/1000`,
      `${correctDecisions} doğru, ${wrongDecisions} hatalı karar.`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const sendScore = async (event: React.FormEvent) => {
    event.preventDefault();
    if (scoreState.type === "loading" || scoreState.type === "success") return;
    setScoreState({ type: "loading" });
    try {
      const submitted = await submitScore({
        username: username.trim(),
        score: ending.score,
        title: ending.title,
      });
      setScoreState({ type: "success", result: submitted });
      await onScoreSubmitted();
    } catch (error) {
      setScoreState({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Skor liderlik tablosuna eklenemedi.",
      });
    }
  };

  return (
    <motion.main
      className="result-screen simple-result-screen screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <section className="result-shell">
        <header className="result-minimal-top">
          <p><i /> OTURUM SONLANDIRILDI</p>
          <span>{ROUND_DURATION_SECONDS} SANİYE · {ROUND_CARD_COUNT} KAYIT</span>
        </header>

        <div className="result-hero">
          <div className="result-score">
            <strong>{ending.score}</strong>
            <span>/ 1000 İTİBAR</span>
          </div>
          <div className="result-title">
            <small>{ending.scoreRange} PUAN ARALIĞI</small>
            <h1>{ending.title}</h1>
            <p>{ending.story[0]}</p>
          </div>
        </div>

        <div
          className="result-compact-stats"
          role="group"
          aria-label="Karar özeti"
        >
          <div><strong>{correctDecisions}</strong><span>doğru karar</span></div>
          <div><strong>{wrongDecisions}</strong><span>hatalı karar</span></div>
          <div><strong>%{breakdown.decisionAccuracy}</strong><span>karar doğruluğu</span></div>
          <div><strong>{breakdown.roundScoreCeiling}</strong><span>turun puan tavanı</span></div>
        </div>

        <section className="leaderboard-submit compact-leaderboard">
          <div>
            <p className="screen-eyebrow">LİDERLİK TABLOSU</p>
            <h2>Skorunu kaydet.</h2>
          </div>
          {scoreState.type === "success" ? (
            <div className="score-success" role="status">
              <strong>#{scoreState.result.rank}</strong>
              <span>{scoreState.result.total} oyuncu arasında yerini aldın.</span>
            </div>
          ) : (
            <form onSubmit={sendScore}>
              <label htmlFor="score-username">Kullanıcı adı · 3–20 karakter</label>
              <div>
                <input
                  id="score-username"
                  value={username}
                  minLength={3}
                  maxLength={20}
                  pattern="[\p{L}\p{N}._-]{3,20}"
                  title="Yalnızca harf, rakam, nokta, alt çizgi ve kısa çizgi kullanın."
                  autoComplete="nickname"
                  placeholder="Kullanıcı adın"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
                <button type="submit" disabled={scoreState.type === "loading"}>
                  {scoreState.type === "loading" ? "Kaydediliyor…" : "Skoru ekle"}
                </button>
              </div>
              {scoreState.type === "error" ? (
                <small role="alert">{scoreState.message}</small>
              ) : null}
            </form>
          )}
        </section>

        <footer className="result-actions">
          <button className="primary-button" type="button" onClick={onReplay}>
            Tekrar oyna <span>↻</span>
          </button>
          <button type="button" onClick={copyResult}>
            {copied ? "Kopyalandı" : "Sonucu kopyala"}
          </button>
          <button type="button" onClick={onMenu}>Ana menü</button>
        </footer>
      </section>
    </motion.main>
  );
}
