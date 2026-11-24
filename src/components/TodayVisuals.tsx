"use client";
/**
 * Two quiet pictures on Dnes:
 *  - ExamPath: the days from her first recent study day to the exam — what is behind her, where she is, how far it is.
 *  - KnowledgeMap: every core point as one small square, grouped by topic and coloured by status; today's new ones
 *    are ringed and appear once with a short fade.
 * No targets, streaks or judgement: an empty past day is just a small neutral dot.
 */
import type { PointWithTopic } from "@/content/schema";
import { pointStatus, type PointStatus } from "@/engine/state";
import { dayDiff, dayKey } from "@/engine/time";
import type { PointState } from "@/engine/types";
import { topicsById } from "@/lib/content";
import { plural } from "@/lib/format";
import { statusMeta } from "./StatusDot";

const WEEKDAY_SHORT = ["ne", "po", "út", "st", "čt", "pá", "so"];
const shift = (key: string, days: number) => new Date(Date.parse(`${key}T12:00:00Z`) + days * 86400_000);
const label = (d: Date) => `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`;

/** Days shown ahead of today at most; a later exam is drawn after a gap. */
const MAX_AHEAD = 20;

export function ExamPath({ answersByDay, examDate, now }: { answersByDay: Record<string, number>; examDate: string; now: Date }) {
  const today = dayKey(now);
  const daysLeft = dayDiff(today, examDate);
  if (daysLeft <= 0) return null;

  const studied = Object.keys(answersByDay).filter((k) => answersByDay[k] > 0 && dayDiff(k, today) >= 0 && dayDiff(k, today) < 14);
  const startAgo = studied.length ? Math.max(...studied.map((k) => dayDiff(k, today))) : 0;
  const ahead = Math.min(daysLeft - 1, MAX_AHEAD); // days between today and the exam that get their own dot
  const gap = daysLeft - 1 > MAX_AHEAD;
  const max = Math.max(12, ...studied.map((k) => answersByDay[k]));

  type Col = { key: string; kind: "past" | "today" | "future" | "gap" | "exam"; answers: number; date: Date };
  const cols: Col[] = [];
  for (let i = -startAgo; i <= ahead; i++) {
    const d = shift(today, i);
    const key = d.toISOString().slice(0, 10);
    cols.push({ key, kind: i < 0 ? "past" : i === 0 ? "today" : "future", answers: answersByDay[key] ?? 0, date: d });
  }
  if (gap) cols.push({ key: "gap", kind: "gap", answers: 0, date: shift(today, ahead + 1) });
  cols.push({ key: examDate, kind: "exam", answers: 0, date: shift(examDate, 0) });

  const n = cols.length;
  const todayIdx = startAgo;
  const at = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const size = (a: number) => (a ? Math.round(7 + 7 * Math.sqrt(a / max)) : 4);

  return (
    <section aria-labelledby="cesta" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="cesta" className="text-[15.5px] text-muted">
          Cesta ke zkoušce
        </h2>
        <span className="text-[15.5px] font-semibold text-sage-700">{daysLeft === 1 ? "zítra" : `za ${plural(daysLeft, "den", "dny", "dní")}`}</span>
      </div>
      <div aria-hidden className="relative">
        {/* the horizon: solid behind her, dotted ahead */}
        <div className="absolute top-1/2 h-px -translate-y-1/2 bg-line-strong" style={{ left: at(0), width: `calc(${at(todayIdx)} - ${at(0)})` }} />
        <div
          className="absolute top-1/2 h-0 -translate-y-1/2 border-t border-dashed border-line-strong"
          style={{ left: at(todayIdx), right: `calc(100% - ${at(n - 1)})` }}
        />
        <ol className="relative grid h-7 items-center" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {cols.map((c) => (
            <li key={c.key} className="flex items-center justify-center">
              {c.kind === "past" && (
                <span className={`rounded-full ${c.answers ? "bg-sage-500" : "bg-line-strong"}`} style={{ width: size(c.answers), height: size(c.answers) }} />
              )}
              {c.kind === "today" &&
                (c.answers ? (
                  <span className="rounded-full bg-sage-700 ring-2 ring-sage-200 ring-offset-2 ring-offset-paper" style={{ width: size(c.answers), height: size(c.answers) }} />
                ) : (
                  <span className="h-3 w-3 rounded-full border-2 border-sage-600 bg-paper" />
                ))}
              {c.kind === "future" && <span className="h-[7px] w-[7px] rounded-full border border-line-strong bg-paper" />}
              {c.kind === "gap" && <span className="text-[13px] leading-none text-faint">…</span>}
              {c.kind === "exam" && <span className="h-3 w-3 rotate-45 rounded-[2px] bg-sage-700" />}
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden className="relative h-4 text-[12.5px] leading-none text-faint">
        {todayIdx >= 4 && <span className="absolute left-0">{label(cols[0].date)}</span>}
        <span
          className={`absolute font-semibold text-ink ${todayIdx < 4 ? "left-0" : "-translate-x-1/2"}`}
          style={todayIdx < 4 ? undefined : { left: at(todayIdx) }}
        >
          dnes
        </span>
        <span className="absolute right-0 text-sage-700">{label(cols[n - 1].date)}</span>
      </div>
      <p className="sr-only">
        Zkouška {label(cols[n - 1].date)}, {daysLeft === 1 ? "zítra" : `za ${plural(daysLeft, "den", "dny", "dní")}`}. Studovala jsi{" "}
        {plural(studied.length, "den", "dny", "dní")} z posledních {startAgo + 1}.
      </p>
    </section>
  );
}

const MAP_COLOR: Record<PointStatus, string> = {
  solid: statusMeta.solid.bar,
  learning: statusMeta.learning.bar,
  weak: statusMeta.weak.bar,
  new: "bg-line",
};

const LEGEND: PointStatus[] = ["solid", "learning", "weak"];

export function KnowledgeMap({ points, states, now }: { points: PointWithTopic[]; states: Map<string, PointState>; now: Date }) {
  const today = dayKey(now);
  const beds = new Map<string, { p: PointWithTopic; status: PointStatus; fresh: number | null }[]>();
  let fresh = 0;
  for (const p of points) {
    if (p.tier === "C") continue;
    const st = states.get(p.id);
    const isFresh = !!st?.introducedAt && dayKey(st.introducedAt) === today;
    const bed = beds.get(p.topicId) ?? [];
    bed.push({ p, status: pointStatus(st, p), fresh: isFresh ? fresh++ : null });
    beds.set(p.topicId, bed);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* One bed per topic, in syllabus order; each square is one point. */}
      <div aria-hidden className="flex flex-wrap items-start gap-x-2.5 gap-y-3 sm:gap-x-4 sm:gap-y-3.5">
        {[...beds.entries()].map(([topicId, cells]) => (
          <div key={topicId} title={topicsById.get(topicId)?.title} className="grid grid-cols-[repeat(6,7px)] gap-[2px] sm:grid-cols-[repeat(5,10px)] sm:gap-[2.5px]">
            {cells.map((c) => (
              <span
                key={c.p.id}
                className={`aspect-square rounded-[2px] sm:rounded-[2.5px] ${MAP_COLOR[c.status]} ${
                  c.fresh !== null ? "animate-sprout outline-[1.5px] outline-offset-[1px] outline-sage-500 outline-solid" : ""
                }`}
                style={c.fresh !== null ? { animationDelay: `${250 + c.fresh * 70}ms` } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-faint">
        <span>
          Čtvereček = poznatek, skupina = téma
          {fresh ? (
            <>
              , dnes {plural(fresh, "přibyl", "přibyly", "přibylo", false)} <span className="font-semibold text-sage-700">{fresh}</span>
            </>
          ) : null}
          .
        </span>
        <span aria-hidden className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-[9px] w-[9px] rounded-[2.5px] ${MAP_COLOR[s]}`} />
              {statusMeta[s].label.toLowerCase()}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
