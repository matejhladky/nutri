"use client";
/** Progress sections shared by Pokrok (her own) and the admin overview (read-only, about her). */
import Link from "next/link";
import type { PointWithTopic } from "@/content/schema";
import { pointStatus, type PointStatus } from "@/engine/state";
import type { PointState } from "@/engine/types";
import { content, topicsById } from "@/lib/content";
import { ActivityChart, newPointsLastWeek, recentDays, WeekSummary } from "./Activity";
import { emptyCounts, STATUS_ORDER, StatusBar, StatusDot, statusMeta } from "./StatusDot";

/** Competencies 1–4 are tested in writing, 5–11 orally and practically. */
const WRITTEN = new Set(["1", "2", "3", "4"]);

export const corePoints = (points: PointWithTopic[]) => points.filter((p) => p.tier !== "C");

export function countStatuses(points: PointWithTopic[], states: Map<string, PointState>): Record<PointStatus, number> {
  const c = emptyCounts();
  for (const p of points) c[pointStatus(states.get(p.id), p)]++;
  return c;
}

export function ActivitySection(props: {
  points: PointWithTopic[];
  states: Map<string, PointState>;
  answersByDay: Record<string, number>;
  now: Date;
  self?: boolean;
}) {
  const days = recentDays(props.answersByDay, props.now, 14);
  return (
    <section aria-labelledby="aktivita" className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="aktivita" className="text-[15px] font-semibold text-muted">
          Posledních 14 dní
        </h2>
        <WeekSummary days={days} newPoints={newPointsLastWeek(props.points, props.states, props.now)} self={props.self} />
      </div>
      <ActivityChart days={days} />
    </section>
  );
}

export function StatusOverview({ counts }: { counts: Record<PointStatus, number> }) {
  return (
    <section className="flex flex-col gap-4">
      <StatusBar counts={counts} />
      <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
        {STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <StatusDot status={s} />
            <span className="text-muted">{statusMeta[s].label}</span>
            <span className="font-semibold tabular-nums">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A labelled row with "seen/total" and a thin status bar (competencies, topics). */
export function StatusRow({ title, href, ps, states }: { title: string; href?: string; ps: PointWithTopic[]; states: Map<string, PointState> }) {
  const counts = countStatuses(ps, states);
  const head = (
    <span className="flex items-baseline justify-between gap-4">
      <span className="text-[16px] leading-snug">{title}</span>
      <span className="shrink-0 text-[14px] tabular-nums text-faint">{ps.length ? `${ps.length - counts.new}/${ps.length}` : "—"}</span>
    </span>
  );
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3.5">
      {href ? (
        <Link href={href} className="hover:text-sage-700">
          {head}
        </Link>
      ) : (
        head
      )}
      <StatusBar counts={counts} thin />
    </li>
  );
}

/** Per competency: points whose PRIMARY criterion belongs to it (no double counting), split by exam part. */
export function CompetencyGroups({ core, states }: { core: PointWithTopic[]; states: Map<string, PointState> }) {
  const rows = content.competencies.map((comp) => {
    const ids = new Set(comp.criteria.map((c) => c.id));
    return { comp, ps: core.filter((p) => ids.has(p.criteria[0])) };
  });
  const groups = [
    { title: "Písemná zkouška", rows: rows.filter((r) => WRITTEN.has(r.comp.id)) },
    { title: "Ústní a praktická zkouška", rows: rows.filter((r) => !WRITTEN.has(r.comp.id)) },
  ];
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-14">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-1 text-[15px] font-semibold text-muted">{g.title}</h2>
          <ul>
            {g.rows.map(({ comp, ps }) => (
              <StatusRow key={comp.id} title={comp.title} ps={ps} states={states} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function WeakList({
  core,
  states,
  limit = 5,
  hrefOf = (p) => `/temata/${p.topicId}`,
}: {
  core: PointWithTopic[];
  states: Map<string, PointState>;
  limit?: number;
  hrefOf?: (p: PointWithTopic) => string;
}) {
  const weak = core.filter((p) => pointStatus(states.get(p.id), p) === "weak").slice(0, limit);
  if (!weak.length) return null;
  return (
    <section>
      <h2 className="mb-1 text-[15px] font-semibold text-muted">Potřebuje opakovat</h2>
      <ul>
        {weak.map((p) => (
          <li key={p.id}>
            <Link href={hrefOf(p)} className="flex items-baseline gap-4 border-b border-line py-3 hover:text-sage-700">
              <span className="flex-1 text-[16px] leading-snug">{p.title}</span>
              <span className="hidden shrink-0 text-[13.5px] text-faint sm:inline">{topicsById.get(p.topicId)?.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
