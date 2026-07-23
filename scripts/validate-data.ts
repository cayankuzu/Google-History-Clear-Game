import { reputationEndingVariants } from "../src/data/reputationEndings";
import { searchHistoryCards } from "../src/data/searchHistoryCards";
import { createRoundCards, isRiskyCard } from "../src/game/cardSelection";
import { analyzeEnding } from "../src/game/endingAnalysis";
import { calculateScore, reputationBands } from "../src/game/scoring";
import type { GameResult, SearchHistoryCard } from "../src/types/game";

const ids = new Set(searchHistoryCards.map((card) => card.id));
const texts = new Set(
  searchHistoryCards.map((card) => card.text.trim().toLocaleLowerCase("tr")),
);

if (searchHistoryCards.length !== 62) {
  throw new Error(`Varsayılan havuz 62 kayıt olmalı: ${searchHistoryCards.length}`);
}
if (ids.size !== searchHistoryCards.length) {
  throw new Error("Kart kimliklerinde tekrar var.");
}
if (texts.size !== searchHistoryCards.length) {
  throw new Error("Kart metinlerinde tekrar var.");
}
if (reputationBands.length !== 20) {
  throw new Error(`İtibar unvanı sayısı beklenenden farklı: ${reputationBands.length}`);
}
if (
  reputationBands[0].min !== 0 ||
  reputationBands.at(-1)?.max !== 1000 ||
  reputationBands.some(
    (band, index) =>
      index > 0 && band.min !== reputationBands[index - 1].max + 1,
  )
) {
  throw new Error("İtibar puanı aralıklarında boşluk veya çakışma var.");
}
if (
  reputationEndingVariants.some(
    (variants) => variants.length < 4,
  )
) {
  throw new Error("Her unvan için en az dört sonuç anlatısı gerekli.");
}

let minimumRisk = 66;
let maximumRisk = 0;
for (let round = 0; round < 500; round += 1) {
  const cards = createRoundCards(searchHistoryCards);
  if (cards.length !== 66) {
    throw new Error(`${round + 1}. turda 66 kayıt seçilmedi.`);
  }
  if (new Set(cards.map((card) => card.id)).size !== 66) {
    throw new Error(`${round + 1}. turdaki oynanış kimlikleri benzersiz değil.`);
  }
  const riskCount = cards.filter(isRiskyCard).length;
  minimumRisk = Math.min(minimumRisk, riskCount);
  maximumRisk = Math.max(maximumRisk, riskCount);
}

if (minimumRisk > 10 || maximumRisk < 56) {
  throw new Error(
    `Tur dağılımı yeterince değişken değil: risk aralığı ${minimumRisk}–${maximumRisk}`,
  );
}

const sampleRound = createRoundCards(searchHistoryCards);
const makeResult = (
  deleted: SearchHistoryCard[],
  unprocessed: SearchHistoryCard[],
): GameResult => ({
  deleted,
  kept: [],
  unprocessed,
  elapsedMs: 33_000,
});
const optimalDeleted = sampleRound.filter(isRiskyCard);
const optimalRemaining = sampleRound.filter((card) => !isRiskyCard(card));
const optimal = calculateScore(makeResult(optimalDeleted, optimalRemaining));
const allDeleted = calculateScore(makeResult(sampleRound, []));
const inverted = calculateScore(makeResult(optimalRemaining, optimalDeleted));

if (!(optimal.score > allDeleted.score && allDeleted.score > inverted.score)) {
  throw new Error(
    `Puan sırası hatalı: ideal ${optimal.score}, tümünü sil ${allDeleted.score}, ters ${inverted.score}`,
  );
}
if (optimal.score > optimal.breakdown.roundScoreCeiling) {
  throw new Error("Skor tur tavanını aşıyor.");
}

const ending = analyzeEnding(makeResult(optimalDeleted, optimalRemaining));
if (!ending.title || ending.story.length < 2 || ending.score !== optimal.score) {
  throw new Error("Sonuç anlatısı puan sistemiyle uyumlu değil.");
}

console.log(
  JSON.stringify(
    {
      pool: searchHistoryCards.length,
      sampledRounds: 500,
      riskyCardRange: [minimumRisk, maximumRisk],
      sampleScores: {
        optimal: optimal.score,
        allDeleted: allDeleted.score,
        inverted: inverted.score,
      },
      reputationBands: reputationBands.length,
    },
    null,
    2,
  ),
);
