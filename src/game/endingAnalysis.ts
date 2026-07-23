import { reputationEndingVariants } from "../data/reputationEndings";
import type {
  EndingResult,
  GameResult,
  SearchHistoryCard,
} from "../types/game";
import { isRiskyCard } from "./cardSelection";
import { calculateScore } from "./scoring";

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pickHighlights(result: GameResult): SearchHistoryCard[] {
  const badRemaining = result.unprocessed.filter(isRiskyCard);
  const goodDeleted = result.deleted.filter((card) => !isRiskyCard(card));
  const fallback = result.unprocessed.length
    ? result.unprocessed
    : result.deleted;
  return [...badRemaining, ...goodDeleted, ...fallback]
    .filter(
      (card, index, items) =>
        items.findIndex((candidate) => candidate.id === card.id) === index,
    )
    .slice(0, 3);
}

export function analyzeEnding(result: GameResult): EndingResult {
  const { score, breakdown, band } = calculateScore(result);
  const signature = [...result.deleted, ...result.unprocessed]
    .map((card) => card.id)
    .join(":");
  const seed = hash(signature);
  const tier = Math.min(
    reputationEndingVariants.length - 1,
    Math.floor(score / 200),
  );
  const variants = reputationEndingVariants[tier];
  const primary = variants[seed % variants.length];
  const allDeleted = result.unprocessed.length === 0;

  const actionSummary = allDeleted
    ? breakdown.goodDeleted > breakdown.badDeleted
      ? `Bütün geçmişi sildin; bunun bedeli ${breakdown.goodDeleted} iyi aramayı da yok etmek oldu.`
      : `Bütün geçmişi sildin. ${breakdown.badDeleted} riskli kayıtla birlikte ${breakdown.goodDeleted} iyi kaydı da götürdün.`
    : `${breakdown.badDeleted} riskli kaydı sildin, ${breakdown.goodKept} iyi kaydı korudun; ${breakdown.badRemaining} riskli kayıt telefonda kaldı.`;

  return {
    title: band.title,
    epitaph: `${score} puan · ${band.label} aralığı`,
    story: [primary, actionSummary],
    highlights: pickHighlights(result),
    score,
    scoreRange: band.label,
    breakdown,
  };
}
