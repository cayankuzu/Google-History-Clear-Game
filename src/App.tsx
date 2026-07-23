import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { analyzeEnding } from "./game/endingAnalysis";
import { createRoundCards } from "./game/cardSelection";
import { useGameAudio } from "./hooks/useGameAudio";
import { CrashScene } from "./screens/CrashScene";
import { GameScreen } from "./screens/GameScreen";
import { PhoneUnlockScene } from "./screens/PhoneUnlockScene";
import { ResultScreen } from "./screens/ResultScreen";
import { StartScreen } from "./screens/StartScreen";
import { SubmitSearchScreen } from "./screens/SubmitSearchScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { searchHistoryCards } from "./data/searchHistoryCards";
import { fetchCommunitySearches, fetchScores } from "./services/searchApi";
import type {
  AppScreen,
  CommunitySearch,
  GameResult,
  GameSettings,
  SearchHistoryCard,
  ScoreEntry,
} from "./types/game";

const defaultSettings: GameSettings = {
  sound: true,
};

function readSettings(): GameSettings {
  try {
    const stored = localStorage.getItem("son33-settings");
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>("start");
  const [settings, setSettings] = useState<GameSettings>(readSettings);
  const [communitySearches, setCommunitySearches] = useState<CommunitySearch[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [roundCards, setRoundCards] = useState<SearchHistoryCard[]>(() =>
    createRoundCards(searchHistoryCards),
  );
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [bestScore, setBestScore] = useState(() =>
    Number(localStorage.getItem("son33-best-score") ?? 0),
  );
  const [returningPlayer, setReturningPlayer] = useState(
    () => localStorage.getItem("son33-intro-seen") === "true",
  );
  const { play } = useGameAudio(settings.sound);

  const refreshCommunitySearches = useCallback(async () => {
    try {
      setCommunitySearches(await fetchCommunitySearches());
    } catch {
      setCommunitySearches([]);
    }
  }, []);

  const refreshScores = useCallback(async () => {
    try {
      setScores(await fetchScores("desc"));
    } catch {
      setScores([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchCommunitySearches()
      .then((searches) => {
        if (active) setCommunitySearches(searches);
      })
      .catch(() => {
        if (active) setCommunitySearches([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchScores("desc")
      .then((nextScores) => {
        if (active) setScores(nextScores);
      })
      .catch(() => {
        if (active) setScores([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("son33-settings", JSON.stringify(settings));
  }, [settings]);

  const startRound = useCallback(
    async (skipIntro: boolean) => {
      play("start");
      const latestCommunity = await fetchCommunitySearches().catch(
        () => communitySearches,
      );
      setCommunitySearches(latestCommunity);
      const poolCards: SearchHistoryCard[] = latestCommunity.length
        ? latestCommunity.map((item) => ({
            id: item.id,
            text: item.text,
            categories: [item.category],
            severity: ["normal", "wholesome"].includes(item.category)
              ? 1
              : ["absurd", "relationship", "family"].includes(item.category)
                ? 3
                : 4,
            context: item.id.startsWith("seed-")
              ? "Başlangıç arama havuzu"
              : "Topluluk havuzuna eklenmiş",
          }))
        : searchHistoryCards;
      setRoundCards(createRoundCards(poolCards));
      setGameResult(null);
      setScreen(skipIntro ? "unlock" : "crash");
    },
    [communitySearches, play],
  );

  const finishIntro = useCallback(() => {
    localStorage.setItem("son33-intro-seen", "true");
    setReturningPlayer(true);
    setScreen("unlock");
  }, []);

  const finishGame = useCallback((result: GameResult) => {
    const analysis = analyzeEnding(result);
    setBestScore((current) => {
      if (analysis.score <= current) return current;
      localStorage.setItem("son33-best-score", String(analysis.score));
      return analysis.score;
    });
    setGameResult(result);
    setScreen("result");
  }, []);

  const ending = useMemo(
    () => (gameResult ? analyzeEnding(gameResult) : null),
    [gameResult],
  );

  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        {screen === "start" ? (
          <StartScreen
            key="start"
            settings={settings}
            bestScore={bestScore}
            returningPlayer={returningPlayer}
            pool={communitySearches}
            scores={scores}
            onSettingsChange={setSettings}
            onStart={startRound}
            onSubmit={() => setScreen("submit")}
            onAdmin={() => setScreen("admin")}
          />
        ) : null}
        {screen === "submit" ? (
          <SubmitSearchScreen
            key="submit"
            onBack={() => setScreen("start")}
            pool={communitySearches}
            onSubmitted={(search) => {
              setCommunitySearches((current) => [
                search,
                ...current.filter((item) => item.id !== search.id),
              ]);
            }}
          />
        ) : null}
        {screen === "admin" ? (
          <AdminScreen
            key="admin"
            onBack={() => setScreen("start")}
            onChanged={refreshCommunitySearches}
          />
        ) : null}
        {screen === "crash" ? (
          <CrashScene
            key="crash"
            onDone={finishIntro}
            playSound={play}
          />
        ) : null}
        {screen === "unlock" ? (
          <PhoneUnlockScene
            key="unlock"
            onDone={() => setScreen("game")}
            playSound={play}
          />
        ) : null}
        {screen === "game" ? (
          <GameScreen
            key={`game-${roundCards[0]?.id}`}
            cards={roundCards}
            onFinish={finishGame}
            playSound={play}
          />
        ) : null}
        {screen === "result" && gameResult && ending ? (
          <ResultScreen
            key="result"
            result={gameResult}
            ending={ending}
            onScoreSubmitted={refreshScores}
            onReplay={() => {
              startRound(true);
            }}
            onMenu={() => {
              setGameResult(null);
              setScreen("start");
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
