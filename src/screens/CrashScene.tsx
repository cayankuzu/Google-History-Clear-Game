import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { InnerMonologue } from "../components/InnerMonologue";

const monologueTimeline = [
  [900, "Gece sakin. Fazla sakin."],
  [2200, "O farlar neden üzerime geliyor?"],
  [3500, "AH—"],
  [4500, "Ahh... ne oldu?"],
  [5400, "Kaza yaptım."],
  [6300, "Çok kan kaybediyorum."],
  [7100, "Telefon... nerede?"],
  [7900, "Tamam, buldum."],
  [8700, "Kesin öleceğim."],
  [9500, "Yapmam gereken son bir şey var."],
] as const;

type CrashSceneProps = {
  onDone: () => void;
  playSound: (
    name: "horn" | "crash" | "ring" | "heartbeat",
  ) => void;
};

export function CrashScene({
  onDone,
  playSound,
}: CrashSceneProps) {
  const duration = 10400;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const nextElapsed = now - startedAt;
      setElapsed(nextElapsed);
      if (nextElapsed >= duration) {
        onDone();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, onDone]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => playSound("horn"), 2350),
      window.setTimeout(() => playSound("crash"), 3200),
      window.setTimeout(() => playSound("ring"), 3900),
      window.setTimeout(() => playSound("heartbeat"), 6600),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [playSound]);

  const messages = useMemo(
    () =>
      monologueTimeline
        .filter(([time]) => time <= elapsed)
        .map(([, message]) => message),
    [elapsed],
  );

  const phase =
    elapsed < duration * 0.22
      ? "drive"
      : elapsed < duration * 0.36
        ? "danger"
        : elapsed < duration * 0.47
          ? "impact"
          : elapsed < duration * 0.68
            ? "blackout"
            : "reach";

  return (
    <motion.main
      className={`crash-screen screen phase-${phase}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button className="scene-skip" type="button" onClick={onDone}>
        Sahneyi atla <span>→</span>
      </button>

      <div className="road-scene" aria-hidden="true">
        <div className="night-sky">
          {Array.from({ length: 16 }, (_, index) => (
            <i key={index} style={{ "--star": index } as React.CSSProperties} />
          ))}
        </div>
        <div className="windshield">
          <span className="windshield-glare" />
          <span className="crack crack-one" />
          <span className="crack crack-two" />
        </div>
        <div className="road">
          <span className="lane lane-left" />
          <span className="lane lane-right" />
        </div>
        <div className="incoming-car">
          <span />
          <span />
        </div>
        <div className="steering-wheel" />
        <div className="impact-flash" />
        <div className="blood-vignette" />
        <div className="ground-phone">
          <span>16:45</span>
          <b>17 cevapsız arama</b>
        </div>
        <div className="reaching-hand" />
      </div>

      <div className="crash-caption">
        <span>{phase === "reach" ? "HAYATİ İŞLEM" : "KONUM BİLİNMİYOR"}</span>
        <strong>
          {phase === "drive" && "Yol boş görünüyordu."}
          {phase === "danger" && "Fren mesafesi: yetersiz."}
          {phase === "impact" && "ÇARPIŞMA"}
          {phase === "blackout" && "Sinyal aranıyor…"}
          {phase === "reach" && "Telefona ulaş."}
        </strong>
      </div>

      <InnerMonologue messages={messages} />
    </motion.main>
  );
}
