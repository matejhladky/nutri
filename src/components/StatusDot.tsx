import type { PointStatus } from "@/engine/state";

/** Dark green = solid, pale green = in progress, honey = needs repeating, line = not yet seen. */
export const statusMeta: Record<PointStatus, { label: string; dot: string; bar: string }> = {
  solid: { label: "Naučeno", dot: "bg-sage-600", bar: "bg-sage-600" },
  learning: { label: "Rozpracováno", dot: "bg-sage-200", bar: "bg-sage-200" },
  weak: { label: "Potřebuje opakovat", dot: "bg-amber-600", bar: "bg-amber-600" },
  new: { label: "Zatím neprobráno", dot: "bg-line-strong", bar: "bg-line" },
};

export const STATUS_ORDER: PointStatus[] = ["solid", "learning", "weak", "new"];

export function StatusDot({ status }: { status: PointStatus }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta[status].dot}`} title={statusMeta[status].label} />;
}

/** Stacked bar of point statuses (proportions only; counts are shown elsewhere where useful). */
export function StatusBar({ counts, thin = false }: { counts: Record<PointStatus, number>; thin?: boolean }) {
  const total = counts.solid + counts.learning + counts.weak + counts.new;
  const h = thin ? "h-1" : "h-2";
  if (!total) return <div className={`${h} rounded-full bg-line`} />;
  return (
    <div className={`flex ${h} gap-px overflow-hidden rounded-full bg-line`} aria-hidden>
      {STATUS_ORDER.map((s) => (counts[s] && s !== "new" ? <div key={s} className={statusMeta[s].bar} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null))}
    </div>
  );
}

export const emptyCounts = (): Record<PointStatus, number> => ({ solid: 0, learning: 0, weak: 0, new: 0 });
