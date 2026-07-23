import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type PhoneUnlockSceneProps = {
  onDone: () => void;
  playSound: (name: "unlock-fail" | "unlock") => void;
};

export function PhoneUnlockScene({
  onDone,
  playSound,
}: PhoneUnlockSceneProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => {
        setStep(1);
        playSound("unlock-fail");
      }, 900),
      window.setTimeout(() => {
        setStep(2);
        playSound("unlock");
      }, 1900),
      window.setTimeout(() => setStep(3), 2800),
      window.setTimeout(onDone, 4200),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [onDone, playSound]);

  return (
    <motion.main
      className="unlock-screen screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={`phone-device unlock-step-${step}`}>
        <div className="phone-speaker" />
        <div className="phone-screen">
          <div className="phone-status">
            <span>16:45</span>
            <span>4G+ · %31</span>
          </div>
          {step < 3 ? (
            <section className="lock-panel">
              <p>23 TEMMUZ · PERŞEMBE</p>
              <strong>16:45</strong>
              <div className={`fingerprint ${step === 1 ? "is-failed" : ""}`}>
                <span>◎</span>
              </div>
              <b>
                {step === 0 && "Parmağını sensöre koy"}
                {step === 1 && "Parmak izi okunamadı · elin titriyor"}
                {step === 2 && "Kilit açıldı"}
              </b>
            </section>
          ) : (
            <section className="history-launch">
              <div className="browser-orb">K</div>
              <strong>KAYITLAR</strong>
              <p>Geçmiş yükleniyor…</p>
              <span className="launch-loader" />
            </section>
          )}
          <div className="screen-cracks" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="phone-home" />
      </div>

      <div className="unlock-copy">
        <p className="screen-eyebrow">SON İŞLEM</p>
        <h1>
          Arama geçmişimi
          <br />
          kimse görmemeli.
        </h1>
        <p>Çabuk ol. ÇABUK OL.</p>
      </div>
    </motion.main>
  );
}
