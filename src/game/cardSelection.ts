import type { SearchHistoryCard } from "../types/game";

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
  count = 66,
): SearchHistoryCard[] {
  const unique = Array.from(
    new Map(pool.map((card) => [card.text.trim().toLocaleLowerCase("tr"), card])).values(),
  );
  if (!unique.length) return [];

  const risky = unique.filter(isRiskyCard);
  const ordinary = unique.filter((card) => !isRiskyCard(card));
  const riskyTarget =
    risky.length && ordinary.length
      ? Math.floor(Math.random() * (count + 1))
      : risky.length
        ? count
        : 0;

  const draw = (source: SearchHistoryCard[], amount: number, prefix: string) =>
    Array.from({ length: amount }, (_, index) => {
      const card = source[Math.floor(Math.random() * source.length)];
      return {
        ...card,
        id: `${card.id}-${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      };
    });

  return shuffle([
    ...draw(risky, riskyTarget, "risk"),
    ...draw(ordinary, count - riskyTarget, "safe"),
  ]);
}

export function isRiskyCard(card: SearchHistoryCard): boolean {
  return (
    card.severity >= 3 ||
    card.categories.some((category) =>
      ["adult", "crime", "betrayal"].includes(category),
    )
  );
}
