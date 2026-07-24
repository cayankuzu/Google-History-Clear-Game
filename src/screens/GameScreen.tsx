import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  useMotionValue,
  type PanInfo,
} from "framer-motion";
import type {
  GameResult,
  SearchHistoryCard,
} from "../types/game";
import { ROUND_DURATION_MS } from "../constants/game";

const ROUND_DURATION = ROUND_DURATION_MS;

const DATE_BUCKETS = [
  { until: 7, daysAgo: 0 },
  { until: 15, daysAgo: 1 },
  { until: 24, daysAgo: 3 },
  { until: 34, daysAgo: 7 },
  { until: 45, daysAgo: 14 },
  { until: 56, daysAgo: 30 },
  { until: Number.POSITIVE_INFINITY, daysAgo: 60 },
];

function getHistoryDateLabel(originalIndex: number) {
  const bucket =
    DATE_BUCKETS.find(({ until }) => originalIndex < until) ??
    DATE_BUCKETS[DATE_BUCKETS.length - 1];

  if (bucket.daysAgo === 0) return "BUGÜN";
  if (bucket.daysAgo === 1) return "DÜN";

  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - bucket.daysAgo);

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: bucket.daysAgo >= 60 ? "numeric" : undefined,
  })
    .format(date)
    .toLocaleUpperCase("tr-TR");
}

type GameScreenProps = {
  cards: SearchHistoryCard[];
  onFinish: (result: GameResult) => void;
  playSound: (name: "delete" | "keep" | "heartbeat" | "death") => void;
};

type HistoryRowProps = {
  card: SearchHistoryCard;
  disabled: boolean;
  reducedMotion: boolean;
  onDelete: (card: SearchHistoryCard) => void;
};

function HistoryRow({
  card,
  disabled,
  reducedMotion,
  onDelete,
}: HistoryRowProps) {
  const x = useMotionValue(0);

  const finishDrag = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x < -88 || info.velocity.x < -620) {
      onDelete(card);
      return;
    }
    void animate(x, 0, {
      duration: reducedMotion ? 0.01 : 0.18,
      ease: "easeOut",
    });
  };

  return (
    <motion.article
      className="history-list-row"
      layout
      drag={disabled ? false : "x"}
      dragDirectionLock
      dragConstraints={{ left: -150, right: 0 }}
      dragElastic={{ left: 0.28, right: 0.04 }}
      onDragEnd={finishDrag}
      style={{ x }}
      exit={{ x: -520, opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.22 }}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Delete" || event.key === "Backspace" || event.key === "ArrowLeft") {
          event.preventDefault();
          onDelete(card);
        }
      }}
      aria-label={`${card.text}. Silmek için sola sürükleyin.`}
    >
      <div className="row-delete-reveal" aria-hidden="true">SİL</div>
      <span className="row-history-icon" aria-hidden="true">◷</span>
      <div className="row-history-copy">
        <strong>{card.text}</strong>
        <small>{card.context ?? "Yakın zamanda arandı"}</small>
      </div>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onDelete(card)}
        aria-label={`${card.text} kaydını sil`}
      >
        ×
      </button>
    </motion.article>
  );
}

export function GameScreen({
  cards,
  onFinish,
  playSound,
}: GameScreenProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const [remaining, setRemaining] = useState(cards);
  const [deleted, setDeleted] = useState<SearchHistoryCard[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [locked, setLocked] = useState(false);
  const stateRef = useRef({ remaining: cards, deleted: [] as SearchHistoryCard[] });
  const finishedRef = useRef(false);
  const lastHeartbeatRef = useRef(-1);

  const finish = useCallback(
    (elapsedMs: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setLocked(true);
      playSound("death");
      onFinish({
        deleted: stateRef.current.deleted,
        kept: [],
        unprocessed: stateRef.current.remaining,
        elapsedMs,
      });
    },
    [onFinish, playSound],
  );

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const next = Math.max(0, ROUND_DURATION - elapsed);
      setTimeLeft(next);
      const second = Math.ceil(next / 1000);
      if (second <= 10 && second > 0 && lastHeartbeatRef.current !== second) {
        lastHeartbeatRef.current = second;
        playSound("heartbeat");
      }
      if (next <= 0) {
        finish(ROUND_DURATION);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finish, playSound]);

  const removeCard = useCallback(
    (card: SearchHistoryCard) => {
      if (locked || !stateRef.current.remaining.some((item) => item.id === card.id)) return;
      playSound("delete");
      const nextRemaining = stateRef.current.remaining.filter((item) => item.id !== card.id);
      const nextDeleted = [...stateRef.current.deleted, card];
      stateRef.current = { remaining: nextRemaining, deleted: nextDeleted };
      setRemaining(nextRemaining);
      setDeleted(nextDeleted);
    },
    [locked, playSound],
  );

  const formattedTime = (timeLeft / 1000).toFixed(1).padStart(4, "0");
  const seconds = Math.ceil(timeLeft / 1000);
  const danger = seconds <= 10;
  const critical = seconds <= 5;
  const cardDates = useMemo(
    () =>
      new Map(
        cards.map((card, index) => [card.id, getHistoryDateLabel(index)]),
      ),
    [cards],
  );
  const dateGroups = useMemo(() => {
    const groups: { label: string; cards: SearchHistoryCard[] }[] = [];

    remaining.forEach((card) => {
      const label = cardDates.get(card.id) ?? "DAHA ESKİ";
      const lastGroup = groups[groups.length - 1];

      if (lastGroup?.label === label) {
        lastGroup.cards.push(card);
      } else {
        groups.push({ label, cards: [card] });
      }
    });

    return groups;
  }, [cardDates, remaining]);

  return (
    <motion.main
      className={`game-screen screen history-list-game ${danger ? "is-danger" : ""} ${critical ? "is-critical" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="game-topbar">
        <div className="history-brand">
          <div className="browser-orb">G</div>
          <div>
            <span>ARAMA GEÇMİŞİ</span>
            <small>Bu cihaz · Son etkinlikler</small>
          </div>
        </div>
        <div className="round-progress">
          <span>{deleted.length} / {cards.length} kayıt silindi</span>
          <div><i style={{ width: `${(deleted.length / cards.length) * 100}%` }} /></div>
        </div>
        <div className="timer-block" aria-live="polite">
          <span>KALAN SÜRE</span>
          <strong>{formattedTime}</strong>
        </div>
      </header>

      <section className="history-workspace list-workspace">
        <aside className="history-sidebar">
          <p className="screen-eyebrow">ACİL TEMİZLİK</p>
          <h1>Geçmişini<br />temizle.</h1>
          <p>
            Listeyi kaydır, silmek istediğin kaydı sola sürükle. Sağdaki çarpı
            da aynı işi yapar. Silmediğin her satır senden sonra konuşacak.
          </p>
          <div className="live-stats">
            <span><b>{deleted.length}</b> silindi</span>
            <span><b>{remaining.length}</b> kaldı</span>
            <span><b>{cards.length}</b> toplam</span>
          </div>
        </aside>

        <div className="phone-stage">
          <div className="phone-game-device list-phone">
            <div className="phone-game-status">
              <span>16:45</span>
              <b className={danger ? "is-red" : ""}>♥ {seconds}</b>
              <span>4G+ · %31</span>
            </div>
            <div className="history-app-header">
              <button type="button" aria-label="Geri" tabIndex={-1}>‹</button>
              <div><span>⌕</span><p>Geçmişte ara</p></div>
              <span>⋮</span>
            </div>
            <div className="history-scroll-list" aria-live="polite">
              {dateGroups.map((group) => (
                <section className="history-date-group" key={group.label}>
                  <div className="history-date history-date-inline">
                    <span>{group.label}</span>
                    <b>{group.cards.length} kayıt</b>
                  </div>
                  <AnimatePresence initial={false}>
                    {group.cards.map((card) => (
                      <HistoryRow
                        card={card}
                        disabled={locked}
                        reducedMotion={reducedMotion}
                        onDelete={removeCard}
                        key={card.id}
                      />
                    ))}
                  </AnimatePresence>
                </section>
              ))}
              {!remaining.length ? (
                <motion.div className="list-cleared" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span>✓</span>
                  <strong>Arama geçmişi boş.</strong>
                  <p>Telefonunda anlatacak bir şey kalmadı.</p>
                </motion.div>
              ) : null}
            </div>
            <div className="swipe-help">Satırı sola sürükle ← · Listeyi yukarı aşağı kaydır</div>
            <div className="phone-cracks" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>

        <aside className="list-side-note">
          <span>NORMAL GÖRÜNENLER</span>
          <p>
            Masum bir aramayı silmek puan kaybettirebilir. Utanç verici olanı
            bırakmak ise finalini tamamen değiştirebilir.
          </p>
          <strong>{remaining.length ? "Telefon hâlâ konuşuyor." : "Sessizlik."}</strong>
        </aside>
      </section>

      {seconds <= 3 && seconds > 0 ? (
        <motion.div
          className="final-countdown"
          key={seconds}
          initial={{ opacity: 0, scale: 1.4 }}
          animate={{ opacity: 0.95, scale: 1 }}
        >
          {seconds}
        </motion.div>
      ) : null}
    </motion.main>
  );
}
