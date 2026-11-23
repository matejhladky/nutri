import raw from "@/generated/content.json";
import type { ContentBundle, Criterion, Competency, PointWithTopic, Topic } from "@/content/schema";
import { confusablePartners } from "@/engine/planner";

export const content = raw as unknown as ContentBundle;

export const pointsById = new Map<string, PointWithTopic>(content.points.map((p) => [p.id, p]));
export const topicsById = new Map<string, Topic>(content.topics.map((t) => [t.id, t]));

const criteria = new Map<string, { criterion: Criterion; competency: Competency }>();
for (const competency of content.competencies) {
  for (const criterion of competency.criteria) criteria.set(criterion.id, { criterion, competency });
}
export const criterionInfo = (id: string) => criteria.get(id);

const partners = confusablePartners(content.points);
/** Points she is likely to mix up with this one (symmetric). */
export const confusablesOf = (id: string): PointWithTopic[] =>
  [...(partners.get(id) ?? [])].flatMap((q) => pointsById.get(q) ?? []);

/** Points with reported (hidden) exercises removed; a point whose whole report is point-level, or with no exercises left, disappears. */
export function visiblePoints(reports: { pointId: string; exerciseId: string | null }[]): PointWithTopic[] {
  if (!reports.length) return content.points;
  const hiddenPoints = new Set(reports.filter((r) => !r.exerciseId).map((r) => r.pointId));
  const hiddenEx = new Set(reports.filter((r) => r.exerciseId).map((r) => `${r.pointId}/${r.exerciseId}`));
  return content.points.flatMap((p) => {
    if (hiddenPoints.has(p.id)) return [];
    const exercises = p.exercises.filter((e) => !hiddenEx.has(`${p.id}/${e.id}`));
    return exercises.length ? [{ ...p, exercises }] : [];
  });
}

/** The same bank without one just-reported item (exercise, or the whole point when no exercise id / none left). */
export function withoutReported(points: PointWithTopic[], r: { pointId: string; exerciseId: string | null }): PointWithTopic[] {
  return points.flatMap((p) => {
    if (p.id !== r.pointId) return [p];
    const exercises = r.exerciseId ? p.exercises.filter((e) => e.id !== r.exerciseId) : [];
    return exercises.length ? [{ ...p, exercises }] : [];
  });
}

/** "s. 12" / "s. 12, 14" */
export const pagesLabel = (pages: number[]) => `s. ${pages.join(", ")}`;
