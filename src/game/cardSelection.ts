import type { SearchHistoryCard } from "../types/game";
import { ROUND_CARD_COUNT } from "../constants/game";

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function createRoundCards(
  pool: readonly SearchHistoryCard[],
  count = ROUND_CARD_COUNT,
): SearchHistoryCard[] {
  const unique = Array.from(
    new Map(pool.map((card) => [card.text.trim().toLocaleLowerCase("tr"), card])).values(),
  );
  if (!unique.length) return [];

  return shuffle(
    Array.from({ length: count }, (_, index) => {
      const card = unique[Math.floor(Math.random() * unique.length)];
      return {
        ...card,
        id: `${card.id}-draw-${index}-${Math.random().toString(36).slice(2, 8)}`,
      };
    }),
  );
}

export function isRiskyCard(card: SearchHistoryCard): boolean {
  return (
    card.severity >= 3 ||
    card.categories.some((category) =>
      ["adult", "crime", "betrayal"].includes(category),
    )
  );
}
