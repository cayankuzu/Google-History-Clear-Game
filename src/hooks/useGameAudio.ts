import { useCallback, useEffect, useRef } from "react";

type SoundName =
  | "start"
  | "horn"
  | "crash"
  | "ring"
  | "unlock-fail"
  | "unlock"
  | "delete"
  | "keep"
  | "heartbeat"
  | "death";

export function useGameAudio(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }
    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume();
    }
    return contextRef.current;
  }, []);

  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      type: OscillatorType,
      volume: number,
      delay = 0,
      endFrequency?: number,
    ) => {
      if (!enabled) return;
      const context = getContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      const end = start + duration;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.001), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    },
    [enabled, getContext],
  );

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled) return;

      switch (name) {
        case "start":
          playTone(120, 0.18, "sine", 0.05, 0, 180);
          break;
        case "horn":
          playTone(210, 0.55, "sawtooth", 0.08);
          playTone(260, 0.55, "square", 0.025);
          break;
        case "crash":
          playTone(90, 0.8, "sawtooth", 0.11, 0, 32);
          playTone(55, 1.2, "square", 0.055, 0.05, 28);
          navigator.vibrate?.([140, 60, 260]);
          break;
        case "ring":
          playTone(3100, 1.5, "sine", 0.025, 0, 2400);
          break;
        case "unlock-fail":
          playTone(120, 0.12, "square", 0.035);
          break;
        case "unlock":
          playTone(440, 0.08, "sine", 0.025);
          playTone(720, 0.14, "sine", 0.03, 0.08);
          break;
        case "delete":
          playTone(420, 0.09, "triangle", 0.025, 0, 180);
          navigator.vibrate?.(20);
          break;
        case "keep":
          playTone(180, 0.08, "sine", 0.018, 0, 230);
          break;
        case "heartbeat":
          playTone(75, 0.1, "sine", 0.065);
          playTone(62, 0.12, "sine", 0.04, 0.15);
          break;
        case "death":
          playTone(740, 2.4, "sine", 0.04, 0, 700);
          navigator.vibrate?.([300, 100, 600]);
          break;
      }
    },
    [enabled, playTone],
  );

  useEffect(
    () => () => {
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  return { play };
}
