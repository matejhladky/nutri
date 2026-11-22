/**
 * Transparent priority of a point for NEW-material planning (docs/architecture.md, planner).
 * A multiplier on the breadth score, built from explicit, inspectable reasons — no hidden weights:
 *   - safety       ×3    wrong knowledge could harm a client / the right action is referral
 *   - case         ×2.5  model client case: trains the practical exam as a whole flow
 *   - foundation   ×(1 + 0.06·d), d = points that (transitively) build on it, capped at 6
 * Tier and per-criterion coverage are handled by the planner's breadth score; this only orders WITHIN that.
 * The full ranking is written to reports/priority.md for review.
 */
import type { PointWithTopic } from "@/content/schema";

export type Priority = { factor: number; reasons: string[] };

export const PRIORITY_WEIGHTS = { safety: 3, case: 2.5, perDependant: 0.06, maxDependants: 6 } as const;

const isCase = (p: PointWithTopic) => p.exercises.some((e) => e.type === "case");

/** Number of points that build on each point, directly or transitively. */
export function dependantCounts(points: PointWithTopic[]): Map<string, number> {
  const children = new Map<string, string[]>();
  for (const p of points) for (const r of p.prereqs) children.set(r, [...(children.get(r) ?? []), p.id]);
  const out = new Map<string, number>();
  for (const p of points) {
    const seen = new Set<string>();
    const stack = [...(children.get(p.id) ?? [])];
    while (stack.length) {
      const c = stack.pop()!;
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(...(children.get(c) ?? []));
    }
    out.set(p.id, seen.size);
  }
  return out;
}

export function computePriorities(points: PointWithTopic[]): Map<string, Priority> {
  const deps = dependantCounts(points);
  const W = PRIORITY_WEIGHTS;
  const out = new Map<string, Priority>();
  for (const p of points) {
    let factor = 1;
    const reasons: string[] = [];
    if (p.safety) {
      factor *= W.safety;
      reasons.push("bezpečnost");
    }
    if (isCase(p)) {
      factor *= W.case;
      reasons.push("modelový případ");
    }
    const d = Math.min(deps.get(p.id) ?? 0, W.maxDependants);
    if (d > 0) {
      factor *= 1 + W.perDependant * d;
      reasons.push(`základ pro ${deps.get(p.id)} dalších`);
    }
    out.set(p.id, { factor, reasons });
  }
  return out;
}
