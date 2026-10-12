import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import type { GameResult, SearchHistoryCard } from "../types/game";
import { ROUND_DURATION_MS } from "../constants/game";

const ROUND_DURATION = ROUND_DURATION_MS;
const UNDO_LIMIT = 3;
const START_BATTERY = 31;

const DATE_BUCKETS = [
  { until: 7, daysAgo: 0 },
  { until: 15, daysAgo: 1 },
  { until: 24, daysAgo: 3 },
  { until: 34, daysAgo: 7 },
  { until: 45, daysAgo: 14 },
  { until: 56, daysAgo: 30 },
  { until: Number.POSITIVE_INFINITY, daysAgo: 60 },
];

/** Telefonun içinde beliren, gerilimi artıran bildirimler. */
const PHONE_NOTICES = [
  { atSecond: 27, icon: "▮", title: "Düşük pil", body: "Pil %12 · güç tasarrufu açılıyor" },
  { atSecond: 15, icon: "✆", title: "Annem arıyor…", body: "3 cevapsız arama" },
  { atSecond: 7, icon: "▮", title: "Pil kritik", body: "Ekran birazdan kararacak" },
];

function historyDateLabel(originalIndex: number) {
  const bucket =
    DATE_BUCKETS.find(({ until }) => originalIndex < until) ?? DATE_BUCKETS[DATE_BUCKETS.length - 1];
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

function historyTimeLabel(originalIndex: number) {
  const minutes = (((16 * 60 + 41 - originalIndex * 37) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

type SoundName = "delete" | "keep" | "heartbeat" | "death";

type GameScreenProps = {
  cards: SearchHistoryCard[];
  onFinish: (result: GameResult) => void;
  playSound: (name: SoundName) => void;
};

type HistoryRowProps = {
  card: SearchHistoryCard;
  time: string;
  active: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  onDelete: (card: SearchHistoryCard) => void;
  onFocus: (card: SearchHistoryCard) => void;
};

function HistoryRow({ card, time, active, disabled, reducedMotion, onDelete, onFocus }: HistoryRowProps) {
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [active, reducedMotion]);

  const finishDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -88 || info.velocity.x < -620) {
      onDelete(card);
      return;
    }
    void animate(x, 0, { duration: reducedMotion ? 0.01 : 0.18, ease: "easeOut" });
  };

  return (
    <motion.div
      className="g40-row-shell"
      layout
      initial={false}
      exit={{ opacity: 0, height: 0, transition: { duration: reducedMotion ? 0.01 : 0.2 } }}
    >
      <div className="g40-row-reveal" aria-hidden="true">
        SİL
      </div>
      <motion.div
        ref={rowRef}
        className={`g40-row${active ? " is-cursor" : ""}`}
        drag={disabled ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={{ left: 0.28, right: 0.04 }}
        onDragEnd={finishDrag}
        style={{ x }}
        tabIndex={0}
        role="listitem"
        onFocus={() => onFocus(card)}
        onKeyDown={(event) => {
          if (["Delete", "Backspace", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            onDelete(card);
          }
        }}
        aria-label={`${card.text}. Silmek için sola sürükle ya da Delete tuşuna bas.`}
      >
        <span className="g40-row-icon" aria-hidden="true">
          ◷
        </span>
        <div className="g40-row-copy">
          <strong>{card.text}</strong>
          <small>{time} · Google'da arandı</small>
        </div>
        <button
          type="button"
          className="g40-row-delete"
          disabled={disabled}
          tabIndex={-1}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(card)}
          aria-label={`${card.text} kaydını sil`}
        >
          ×
        </button>
      </motion.div>
    </motion.div>
  );
}

export function GameScreen({ cards, onFinish, playSound }: GameScreenProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const [remaining, setRemaining] = useState(cards);
  const [deleted, setDeleted] = useState<SearchHistoryCard[]>([]);
  const [undosLeft, setUndosLeft] = useState(UNDO_LIMIT);
  const [cursorId, setCursorId] = useState<string | null>(cards[0]?.id ?? null);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [locked, setLocked] = useState(false);
  const stateRef = useRef({ remaining: cards, deleted: [] as SearchHistoryCard[] });
  const finishedRef = useRef(false);
  const lastHeartbeatRef = useRef(-1);

  const originalIndex = useMemo(() => new Map(cards.map((card, index) => [card.id, index])), [cards]);

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
      // rAF zaman damgası ilk karede başlangıçtan küçük olabilir; süre sınırlandırılır.
      const next = Math.min(ROUND_DURATION, Math.max(0, ROUND_DURATION - (now - startedAt)));
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

  const commit = useCallback((nextRemaining: SearchHistoryCard[], nextDeleted: SearchHistoryCard[]) => {
    stateRef.current = { remaining: nextRemaining, deleted: nextDeleted };
    setRemaining(nextRemaining);
    setDeleted(nextDeleted);
  }, []);

  const removeCard = useCallback(
    (card: SearchHistoryCard) => {
      const current = stateRef.current.remaining;
      const index = current.findIndex((item) => item.id === card.id);
      if (locked || index < 0) return;
      playSound("delete");
      const nextRemaining = current.filter((item) => item.id !== card.id);
      commit(nextRemaining, [...stateRef.current.deleted, card]);
      const neighbour = nextRemaining[index] ?? nextRemaining[index - 1];
      setCursorId(neighbour?.id ?? null);
    },
    [commit, locked, playSound],
  );

  const undo = useCallback(() => {
    const last = stateRef.current.deleted.at(-1);
    if (locked || !last || undosLeft <= 0) return;
    playSound("keep");
    const restoredIds = new Set([...stateRef.current.remaining.map((item) => item.id), last.id]);
    const nextRemaining = cards.filter((card) => restoredIds.has(card.id));
    commit(nextRemaining, stateRef.current.deleted.slice(0, -1));
    setUndosLeft((value) => value - 1);
    setCursorId(last.id);
  }, [cards, commit, locked, playSound, undosLeft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (locked || event.metaKey || event.ctrlKey || event.altKey) return;
      const list = stateRef.current.remaining;
      const index = list.findIndex((item) => item.id === cursorId);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!list.length) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = list[Math.min(list.length - 1, Math.max(0, (index < 0 ? 0 : index) + step))];
        setCursorId(next.id);
        return;
      }
      if (["Delete", "Backspace", "ArrowLeft", "x", "X"].includes(event.key)) {
        const target = list[index] ?? list[0];
        if (!target) return;
        event.preventDefault();
        removeCard(target);
        return;
      }
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cursorId, locked, removeCard, undo]);

  const seconds = Math.ceil(timeLeft / 1000);
  const elapsedRatio = Math.min(1, Math.max(0, 1 - timeLeft / ROUND_DURATION));
  const danger = seconds <= 10;
  const critical = seconds <= 5;
  const bpm = Math.round(64 + Math.pow(elapsedRatio, 1.5) * 116);
  const battery = Math.max(1, Math.round(START_BATTERY - elapsedRatio * 29));
  const formattedTime = (timeLeft / 1000).toFixed(1).padStart(4, "0");
  const notice = PHONE_NOTICES.find((item) => seconds <= item.atSecond && seconds > item.atSecond - 3);
  const lastDeleted = deleted.slice(-4).reverse();

  const dateGroups = useMemo(() => {
    const groups: { label: string; cards: SearchHistoryCard[] }[] = [];
    remaining.forEach((card) => {
      const label = historyDateLabel(originalIndex.get(card.id) ?? 0);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.label === label) lastGroup.cards.push(card);
      else groups.push({ label, cards: [card] });
    });
    return groups;
  }, [originalIndex, remaining]);

  const sceneStyle = {
    "--danger": elapsedRatio.toFixed(3),
    "--beat": `${(60 / bpm).toFixed(3)}s`,
  } as CSSProperties;

  return (
    <motion.main
      className={`g40 screen${danger ? " is-danger" : ""}${critical ? " is-critical" : ""}`}
      style={sceneStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="g40-vignette" aria-hidden="true" />

      <header className="g40-hud">
        <div className="g40-brand">
          <span className="browser-orb">G</span>
          <div>
            <strong>Arama geçmişi</strong>
            <small>Ölüm sonrası mahremiyet protokolü</small>
          </div>
        </div>

        <div className="g40-progress" aria-label="İlerleme">
          <span>
            <b>{deleted.length}</b> / {cards.length} kayıt silindi
          </span>
          <div>
            <i style={{ width: `${(deleted.length / cards.length) * 100}%` }} />
          </div>
        </div>

        <div className="g40-pulse" aria-label={`Nabız ${bpm}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20.5 4.3 13a4.7 4.7 0 0 1 6.6-6.7L12 7.4l1.1-1.1a4.7 4.7 0 0 1 6.6 6.7L12 20.5z" />
          </svg>
          <b>{bpm}</b>
          <small>BPM</small>
        </div>

        <div className="g40-timer" aria-live="off">
          <small>Kalan süre</small>
          <strong>{formattedTime}</strong>
        </div>
      </header>

      <section className="g40-stage">
        <aside className="g40-brief">
          <p className="screen-eyebrow">Acil temizlik</p>
          <h1>
            Geçmişini
            <br />
            temizle.
          </h1>
          <p>
            Utanç verici olanı sil, masum olanı bırak. Silmediğin her satır senden sonra konuşacak; masum
            bir aramayı silmek de puan kaybettirir.
          </p>
          <ul className="g40-keys" aria-label="Kontroller">
            <li>
              <kbd>←</kbd> sola sürükle ya da <kbd>Delete</kbd> · sil
            </li>
            <li>
              <kbd>↑</kbd> <kbd>↓</kbd> · satır seç
            </li>
            <li>
              <kbd>Z</kbd> · son silineni geri al
            </li>
          </ul>
          <dl className="g40-stats">
            <div>
              <dt>Silindi</dt>
              <dd>{deleted.length}</dd>
            </div>
            <div>
              <dt>Kaldı</dt>
              <dd>{remaining.length}</dd>
            </div>
            <div>
              <dt>Geri alma</dt>
              <dd>{undosLeft}</dd>
            </div>
          </dl>
        </aside>

        <div className="g40-phone-wrap">
          <div className="g40-phone">
            <div className="g40-status">
              <span>16:45</span>
              <b className={danger ? "is-red" : ""}>♥ {bpm}</b>
              <span className={battery <= 10 ? "is-red" : ""}>4G · %{battery}</span>
            </div>
            <div className="g40-app-header">
              <span aria-hidden="true">‹</span>
              <div>
                <span aria-hidden="true">⌕</span>
                <p>Geçmişte ara</p>
              </div>
              <span aria-hidden="true">⋮</span>
            </div>

            <div className="g40-list" role="list" aria-label="Arama geçmişi">
              {dateGroups.map((group) => (
                <section className="g40-group" key={group.label}>
                  <div className="g40-date">
                    <span>{group.label}</span>
                    <b>{group.cards.length} kayıt</b>
                  </div>
                  <AnimatePresence initial={false}>
                    {group.cards.map((card) => (
                      <HistoryRow
                        key={card.id}
                        card={card}
                        time={historyTimeLabel(originalIndex.get(card.id) ?? 0)}
                        active={card.id === cursorId}
                        disabled={locked}
                        reducedMotion={reducedMotion}
                        onDelete={removeCard}
                        onFocus={(focused) => setCursorId(focused.id)}
                      />
                    ))}
                  </AnimatePresence>
                </section>
              ))}
              {!remaining.length ? (
                <motion.div className="g40-cleared" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span>✓</span>
                  <strong>Arama geçmişi boş.</strong>
                  <p>Telefonunda anlatacak bir şey kalmadı.</p>
                </motion.div>
              ) : null}
            </div>

            <div className="g40-phone-footer">
              <button type="button" onClick={undo} disabled={locked || !deleted.length || undosLeft <= 0}>
                ↶ Geri al · {undosLeft}
              </button>
              <span>Satırı sola sürükle</span>
            </div>

            <AnimatePresence>
              {notice ? (
                <motion.div
                  className="g40-notice"
                  key={notice.title}
                  initial={{ y: -80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -80, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.01 : 0.35 }}
                >
                  <span aria-hidden="true">{notice.icon}</span>
                  <div>
                    <strong>{notice.title}</strong>
                    <small>{notice.body}</small>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="g40-dim" aria-hidden="true" />
            <div className="g40-cracks" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>

        <aside className="g40-feed" aria-label="Son silinenler">
          <p className="screen-eyebrow">Son silinenler</p>
          <ol>
            <AnimatePresence initial={false}>
              {lastDeleted.map((card, index) => (
                <motion.li
                  key={card.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1 - index * 0.2, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                >
                  {card.text}
                </motion.li>
              ))}
            </AnimatePresence>
            {!lastDeleted.length ? <li className="is-empty">Henüz bir şey silmedin.</li> : null}
          </ol>
          <button
            type="button"
            className="g40-undo"
            onClick={undo}
            disabled={locked || !deleted.length || undosLeft <= 0}
          >
            <kbd>Z</kbd> Son silineni geri al
            <span>{undosLeft} hak</span>
          </button>
          <strong className="g40-feed-note">{remaining.length ? "Telefon hâlâ konuşuyor." : "Sessizlik."}</strong>
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
