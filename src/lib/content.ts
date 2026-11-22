import raw from "@/generated/content.json";
import type { ContentBundle, Criterion, Competency, PointWithTopic, Topic } from "@/content/schema";

export const content = raw as unknown as ContentBundle;

export const pointsById = new Map<string, PointWithTopic>(content.points.map((p) => [p.id, p]));
export const topicsById = new Map<string, Topic>(content.topics.map((t) => [t.id, t]));

const criteria = new Map<string, { criterion: Criterion; competency: Competency }>();
for (const competency of content.competencies) {
  for (const criterion of competency.criteria) criteria.set(criterion.id, { criterion, competency });
}
export const criterionInfo = (id: string) => criteria.get(id);

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

/** "s. 12" / "s. 12, 14" */
export const pagesLabel = (pages: number[]) => `s. ${pages.join(", ")}`;
