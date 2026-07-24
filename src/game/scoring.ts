import type {
  GameResult,
  ScoreBreakdown,
  SearchHistoryCard,
} from "../types/game";
import { isRiskyCard } from "./cardSelection";

export type ReputationBand = {
  min: number;
  max: number;
  title: string;
  label: string;
};

export const reputationBands: ReputationBand[] = [
  { min: 0, max: 49, title: "Dijital Enkaz", label: "0–49" },
  { min: 50, max: 99, title: "Dijital Felaket", label: "50–99" },
  { min: 100, max: 149, title: "Arşiv Sabıkalısı", label: "100–149" },
  { min: 150, max: 199, title: "Arşiv Mezarcısı", label: "150–199" },
  { min: 200, max: 249, title: "Şüphe Mıknatısı", label: "200–249" },
  { min: 250, max: 299, title: "Şüpheli Vatandaş", label: "250–299" },
  { min: 300, max: 349, title: "Panik Acemisi", label: "300–349" },
  { min: 350, max: 399, title: "Kötü Editör", label: "350–399" },
  { min: 400, max: 449, title: "Panik Editörü", label: "400–449" },
  { min: 450, max: 499, title: "Hasar Kontrolü", label: "450–499" },
  { min: 500, max: 549, title: "Dijital Kararsız", label: "500–549" },
  { min: 550, max: 599, title: "Temkinli Temizleyici", label: "550–599" },
  { min: 600, max: 649, title: "Seçici Silici", label: "600–649" },
  { min: 650, max: 699, title: "İtibar Teknisyeni", label: "650–699" },
  { min: 700, max: 749, title: "İtibar Mühendisi", label: "700–749" },
  { min: 750, max: 799, title: "Dijital Stratejist", label: "750–799" },
  { min: 800, max: 849, title: "Geçmiş Bekçisi", label: "800–849" },
  { min: 850, max: 899, title: "Dijital Aziz", label: "850–899" },
  { min: 900, max: 949, title: "İtibar Ustası", label: "900–949" },
  { min: 950, max: 1000, title: "Tertemiz Efsane", label: "950–1000" },
];

export function cardReputation(card: SearchHistoryCard) {
  if (card.categories.includes("wholesome")) return 95;
  if (card.categories.includes("normal")) return 78;
  if (card.categories.includes("crime")) return -100;
  if (card.categories.includes("betrayal")) return -92;
  if (card.categories.includes("adult")) return -86;
  if (card.categories.includes("embarrassing")) return -72;
  if (card.categories.includes("money")) return -42;
  if (card.categories.includes("relationship")) return -30;
  if (card.categories.includes("paranormal")) return -18;
  if (card.categories.includes("sad")) return 12;
  if (card.categories.includes("health")) return 24;
  return 5 - card.severity * 8;
}

function decisionValue(card: SearchHistoryCard, deleted: boolean) {
  if (!card.categories.length) return 0;
  const reputation = cardReputation(card);
  if (deleted) {
    return reputation < 0
      ? Math.abs(reputation) * 0.9 - 8
      : -reputation * 1.15 - 18;
  }
  return reputation;
}

export function calculateScore(result: GameResult): {
  score: number;
  breakdown: ScoreBreakdown;
  band: ReputationBand;
} {
  const deletedIds = new Set(result.deleted.map((card) => card.id));
  const cards = [...result.deleted, ...result.kept, ...result.unprocessed];
  let actual = 0;
  let theoreticalBest = 0;
  let theoreticalWorst = 0;

  cards.forEach((card) => {
    const keepValue = decisionValue(card, false);
    const deleteValue = decisionValue(card, true);
    actual += deletedIds.has(card.id) ? deleteValue : keepValue;
    theoreticalBest += Math.max(keepValue, deleteValue);
    theoreticalWorst += Math.min(keepValue, deleteValue);
  });

  const span = Math.max(1, theoreticalBest - theoreticalWorst);
  const decisionAccuracy = Math.max(
    0,
    Math.min(100, ((actual - theoreticalWorst) / span) * 100),
  );
  const riskyCardsInRound = cards.filter(isRiskyCard).length;
  const safeCardsInRound = cards.length - riskyCardsInRound;
  const riskRatio = cards.length ? riskyCardsInRound / cards.length : 0;
  const balance = Math.max(0, 1 - Math.abs(riskRatio - 0.45) / 0.55);
  const roundScoreCeiling = Math.round(760 + balance * 240);
  const score = Math.max(
    0,
    Math.min(1000, Math.round((decisionAccuracy / 100) * roundScoreCeiling)),
  );

  const goodKept = result.unprocessed.filter((card) => !isRiskyCard(card)).length;
  const badDeleted = result.deleted.filter(isRiskyCard).length;
  const goodDeleted = result.deleted.filter((card) => !isRiskyCard(card)).length;
  const badRemaining = result.unprocessed.filter(isRiskyCard).length;
  const breakdown: ScoreBreakdown = {
    goodKept,
    badDeleted,
    goodDeleted,
    badRemaining,
    riskyCardsInRound,
    safeCardsInRound,
    roundScoreCeiling,
    decisionAccuracy: Math.round(decisionAccuracy),
  };
  const band =
    reputationBands.find((item) => score >= item.min && score <= item.max) ??
    reputationBands[0];

  return { score, breakdown, band };
}
