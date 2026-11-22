import type { PointStatus } from "@/engine/state";

export const statusMeta: Record<PointStatus, { label: string; dot: string; bar: string }> = {
  solid: { label: "Upevněno", dot: "bg-sage-600", bar: "bg-sage-600" },
  learning: { label: "Rozpracováno", dot: "bg-sage-100 ring-1 ring-sage-500", bar: "bg-sage-100" },
  weak: { label: "Potřebuje opakovat", dot: "bg-amber-600", bar: "bg-amber-600/70" },
  new: { label: "Zatím neprobráno", dot: "bg-line-strong", bar: "bg-line" },
};

export function StatusDot({ status }: { status: PointStatus }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta[status].dot}`} title={statusMeta[status].label} />;
}

/** Stacked bar of point statuses (counts, not percentages shown). */
export function StatusBar({ counts }: { counts: Record<PointStatus, number> }) {
  const total = counts.solid + counts.learning + counts.weak + counts.new;
  if (!total) return <div className="h-2 rounded-full bg-line/60" />;
  const order: PointStatus[] = ["solid", "learning", "weak", "new"];
  return (
    <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
      {order.map((s) => (counts[s] ? <div key={s} className={statusMeta[s].bar} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null))}
    </div>
  );
}

export const emptyCounts = (): Record<PointStatus, number> => ({ solid: 0, learning: 0, weak: 0, new: 0 });
