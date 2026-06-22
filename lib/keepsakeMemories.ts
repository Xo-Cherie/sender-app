export type KeepsakeMemoryCard = {
  id: string;
  createdAt: string;
  receivedAt?: string;
};

export type OnThisDayGroup<T extends KeepsakeMemoryCard> = {
  yearsAgo: number;
  cards: T[];
};

/** Date used for “on this day” matching (when the card was received). */
export function getCardMemoryDate(card: KeepsakeMemoryCard): Date {
  return new Date(card.receivedAt || card.createdAt);
}

export function formatYearsAgoLabel(yearsAgo: number): string {
  if (yearsAgo === 1) return '1 year ago';
  return `${yearsAgo} years ago`;
}

/** Cards whose month/day match today, from a prior year (1+ years ago). */
export function getOnThisDayMemoryGroups<T extends KeepsakeMemoryCard>(
  cards: T[],
  referenceDate = new Date()
): OnThisDayGroup<T>[] {
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const refYear = referenceDate.getFullYear();
  const byYearsAgo = new Map<number, T[]>();

  for (const card of cards) {
    const date = getCardMemoryDate(card);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getMonth() !== refMonth || date.getDate() !== refDay) continue;

    const yearsAgo = refYear - date.getFullYear();
    if (yearsAgo < 1) continue;

    const group = byYearsAgo.get(yearsAgo) || [];
    group.push(card);
    byYearsAgo.set(yearsAgo, group);
  }

  return Array.from(byYearsAgo.entries())
    .sort(([a], [b]) => a - b)
    .map(([yearsAgo, groupCards]) => ({ yearsAgo, cards: groupCards }));
}

export function collectOnThisDayCardIds<T extends KeepsakeMemoryCard>(
  groups: OnThisDayGroup<T>[]
): Set<string> {
  return new Set(groups.flatMap((group) => group.cards.map((card) => card.id)));
}
