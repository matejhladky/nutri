/**
 * "Novinka" notices on Dnes after a bigger change. To announce one, add an entry at the top (stable id, date of the
 * change). Each learner sees the newest one she hasn't dismissed; dismissals live in her settings (`seenNews`), so
 * they hold on every device. A learner who only started after a change never sees its notice.
 */
export type NewsItem = { id: string; date: string; title: string; body: string; button: string };

export const NEWS: NewsItem[] = [
  {
    id: "2026-11-25-vzorce",
    date: "2026-11-25",
    title: "Vzorce už nemusíš drtit nazpaměť",
    body: "Ukážou se ti rovnou u každého výpočtu. Co ti jednou vyjde, se už znova neopakuje. A u modelových případů, které už umíš spočítat, máš čísla hotová – zbývá jen rozhodnout.",
    button: "Fuck yeah!",
  },
];

/**
 * The notice to show: the newest not yet dismissed, announced after she started studying (`since` = her earliest
 * introduction, ISO). Nobody started yet → nothing.
 */
export function pendingNews(news: NewsItem[], seen: readonly string[], since: string | null): NewsItem | null {
  if (!since) return null;
  const started = since.slice(0, 10);
  return [...news].sort((a, b) => b.date.localeCompare(a.date)).find((n) => !seen.includes(n.id) && n.date >= started) ?? null;
}
