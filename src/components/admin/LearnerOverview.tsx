"use client";
/** One learner, read-only: the same calculations and pictures she sees, written about her instead of to her. */
import Link from "next/link";
import { useMemo } from "react";
import type { PointWithTopic } from "@/content/schema";
import { dayDiff, dayKey } from "@/engine/time";
import type { PointState } from "@/engine/types";
import { content, pointsById, visiblePoints } from "@/lib/content";
import { czDayWithWeekday } from "@/lib/format";
import type { LearnerOverviewData } from "@/server/admin";
import { ActivitySection, CompetencyGroups, corePoints, countStatuses, StatusOverview, StatusRow, WeakList } from "../Progress";
import { ExamPath } from "../TodayVisuals";

const explorerHref = (p: PointWithTopic) => `/admin/obsah/${p.topicId}#${p.id}`;

/** Scheduled reviews by when they fall due (FSRS due dates of points she has met). */
function dueBuckets(points: PointWithTopic[], states: Map<string, PointState>, now: Date) {
  const today = dayKey(now);
  const b = { today: 0, tomorrow: 0, week: 0 };
  for (const p of points) {
    const due = states.get(p.id)?.card?.dueAt;
    if (!due) continue;
    const d = dayDiff(today, dayKey(due));
    if (d <= 0) b.today++;
    else if (d === 1) b.tomorrow++;
    else if (d < 7) b.week++;
  }
  return b;
}

export function LearnerOverview({ data }: { data: LearnerOverviewData }) {
  const now = useMemo(() => new Date(data.now), [data.now]);
  const states = useMemo(() => new Map(Object.entries(data.states)), [data.states]);
  // What she studies from: the bank minus items she reported (and that are not resolved yet).
  const points = useMemo(() => visiblePoints(data.reports.filter((r) => !r.resolved)), [data.reports]);
  const core = corePoints(points);
  const due = dueBuckets(points, states, now);

  return (
    <div className="flex flex-col gap-12 animate-rise">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[30px] font-semibold tracking-tight lg:text-[36px]">{data.label}</h1>
        <p className="text-muted">
          Zkouška {czDayWithWeekday(data.examDate)}, plán {data.settings.dailyMinutes} minut denně
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
        <ExamPath answersByDay={data.answersByDay} examDate={data.examDate} now={now} />
        <section aria-labelledby="opakovani" className="flex flex-col gap-4">
          <h2 id="opakovani" className="text-[15.5px] text-muted">
            Naplánovaná opakování
          </h2>
          <dl className="grid grid-cols-3 gap-4">
            {[
              ["dnes", due.today],
              ["zítra", due.tomorrow],
              ["do týdne", due.week],
            ].map(([label, n]) => (
              <div key={label} className="flex flex-col-reverse gap-0.5">
                <dt className="text-[13.5px] text-faint">{label}</dt>
                <dd className="font-serif text-[28px] leading-none text-sage-700 tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <ActivitySection points={points} states={states} answersByDay={data.answersByDay} now={now} self={false} />
      <StatusOverview counts={countStatuses(core, states)} />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-14">
        <WeakList core={core} states={states} limit={8} hrefOf={explorerHref} />
        <Reports reports={data.reports} />
      </div>

      <CompetencyGroups core={core} states={states} />

      <section>
        <h2 className="mb-1 text-[15px] font-semibold text-muted">Témata</h2>
        <ul className="grid lg:grid-cols-2 lg:gap-x-14">
          {content.topics.map((t) => (
            <StatusRow key={t.id} title={t.title} href={`/admin/obsah/${t.id}`} ps={core.filter((p) => p.topicId === t.id)} states={states} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Reports({ reports }: { reports: LearnerOverviewData["reports"] }) {
  return (
    <section>
      <h2 className="mb-1 text-[15px] font-semibold text-muted">Nahlášené otázky</h2>
      {!reports.length ? (
        <p className="border-b border-line py-3 text-[15px] text-faint">Zatím nic nenahlásila.</p>
      ) : (
        <ul>
          {reports.map((r) => {
            const p = pointsById.get(r.pointId);
            const ex = r.exerciseId ? p?.exercises.find((e) => e.id === r.exerciseId) : undefined;
            const d = new Date(r.createdAt);
            return (
              <li key={r.id} className="flex flex-col gap-1 border-b border-line py-3">
                <span className="flex items-baseline justify-between gap-4">
                  {p ? (
                    <Link href={ex ? `/admin/nahled/${p.id}/${ex.id}` : explorerHref(p)} className="text-[16px] leading-snug hover:text-sage-700">
                      {p.title}
                    </Link>
                  ) : (
                    <span className="text-[16px] text-faint">{r.pointId}</span>
                  )}
                  <span className="shrink-0 text-[13.5px] text-faint tabular-nums">
                    {r.resolved ? "vyřešeno, " : ""}
                    {d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" })}
                  </span>
                </span>
                {ex && <span className="line-clamp-2 text-[14px] text-muted">{ex.prompt}</span>}
                {r.message && <span className="font-serif text-[15px] italic text-ink/80">„{r.message}“</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
