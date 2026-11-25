"use client";
/**
 * Two quiet pictures on Dnes (also used by the admin overview):
 *  - ExamPath: a calendar-like timeline from her first recent study day to the exam — past days sized by answers,
 *    days off as small ticks, today marked, the days left, the exam.
 *  - KnowledgeMap: every core point as one small square; each topic is a block 4 squares tall (as wide as the topic is
 *    big) filled column by column naučeno → rozpracováno → opakovat → zatím ne, so each block reads as a small progress
 *    bar and blocks wrap as whole units. Today's new points keep their status colour and get a dot (+ a one-off fade).
 * No targets, streaks or judgement.
 */
import type { CSSProperties } from "react";
import type { PointWithTopic } from "@/content/schema";
import { pointStatus, type PointStatus } from "@/engine/state";
import { dayDiff, dayKey } from "@/engine/time";
import type { PointState } from "@/engine/types";
import { topicsById } from "@/lib/content";
import { plural } from "@/lib/format";
import { statusMeta } from "./StatusDot";

const WEEKDAY_SHORT = ["ne", "po", "út", "st", "čt", "pá", "so"];
const shift = (key: string, days: number) => new Date(Date.parse(`${key}T12:00:00Z`) + days * 86400_000);
const dateLabel = (d: Date) => `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`;

/** Verb agreeing with the count: "zbývá 1 den", "zbývají 2 dny", "zbývá 9 dní". */
export const remainingVerb = (n: number) => (n >= 2 && n <= 4 ? "zbývají" : "zbývá");

/** Days shown ahead of today at most; a later exam is drawn after a gap. */
const MAX_AHEAD = 20;
/** Vertical centre of the marks: label row (12 px) + gap (8 px) + half the mark box (8 px). */
const LINE_Y = 28;

export function ExamPath({ answersByDay, examDate, now }: { answersByDay: Record<string, number>; examDate: string; now: Date }) {
  const today = dayKey(now);
  const daysLeft = dayDiff(today, examDate);
  if (daysLeft <= 0) return null;

  const studied = Object.keys(answersByDay).filter((k) => answersByDay[k] > 0 && dayDiff(k, today) >= 0 && dayDiff(k, today) < 14);
  const startAgo = studied.length ? Math.max(...studied.map((k) => dayDiff(k, today))) : 0;
  const ahead = Math.min(daysLeft - 1, MAX_AHEAD); // days between today and the exam that get their own mark
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
  const at = (i: number) => ((i + 0.5) / n) * 100;
  const size = (a: number) => Math.round(6 + 8 * Math.sqrt(a / max));

  return (
    <section aria-labelledby="cesta" className="flex flex-col gap-3">
      <h2 id="cesta" className="text-[14.5px] font-normal text-muted lg:text-[15px]">
        Do zkoušky {remainingVerb(daysLeft)}{" "}
        <strong className="font-semibold text-sage-700">{plural(daysLeft, "den", "dny", "dní")}</strong>
      </h2>
      <div aria-hidden className="relative">
        {/* the line: solid behind her, dashed ahead */}
        <div className="absolute h-[1.5px] bg-sage-200" style={{ top: LINE_Y - 0.75, left: `${at(0)}%`, width: `${at(todayIdx) - at(0)}%` }} />
        <div className="absolute border-t-[1.5px] border-dashed border-line-strong" style={{ top: LINE_Y - 0.75, left: `${at(todayIdx)}%`, width: `${at(n - 1) - at(todayIdx)}%` }} />
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {cols.map((c) => (
            <li key={c.key} className="flex flex-col items-center gap-2">
              <span className="h-3 text-[11px] leading-3 font-semibold whitespace-nowrap text-ink">{c.kind === "today" ? "dnes" : ""}</span>
              <span className="flex h-4 items-center justify-center">
                {c.kind === "past" &&
                  (c.answers ? (
                    <span className="block rounded-full bg-sage-500" style={{ width: size(c.answers), height: size(c.answers) }} />
                  ) : (
                    <span className="block h-[9px] w-[2px] rounded-[1px] bg-line-strong" />
                  ))}
                {c.kind === "today" && (
                  <span className="block h-[13px] w-[13px] rounded-full bg-sage-700 shadow-[0_0_0_3px_var(--color-paper),0_0_0_4.5px_var(--color-sage-200)]" />
                )}
                {c.kind === "future" && <span className="block h-1.5 w-1.5 rounded-full border-[1.5px] border-line-strong bg-paper" />}
                {c.kind === "gap" && <span className="bg-paper px-0.5 text-[13px] leading-none text-faint">…</span>}
                {c.kind === "exam" && <span className="block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-ink" />}
              </span>
              <span className={`hidden text-[11.5px] sm:block ${c.kind === "today" || c.kind === "exam" ? "text-ink" : "text-faint"}`}>
                {c.kind === "exam" ? "zkouška" : c.kind === "gap" ? "" : WEEKDAY_SHORT[c.date.getUTCDay()]}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="sr-only">
        Zkouška {dateLabel(cols[n - 1].date)}. Za posledních {startAgo + 1} {plural(startAgo + 1, "den", "dny", "dní", false)} jsi studovala{" "}
        {plural(studied.length, "den", "dny", "dní")}.
      </p>
    </section>
  );
}

/** Square colours by status (CSS colours, so today's dot can be drawn on top of any of them). */
const FILL: Record<PointStatus, string> = {
  solid: "var(--color-sage-600)",
  learning: "var(--color-sage-200)",
  weak: "var(--color-amber-600)",
  new: "#e3ded2",
};
const ORDER: PointStatus[] = ["solid", "learning", "weak", "new"];
const LEGEND_LABEL: Record<PointStatus, string> = {
  solid: statusMeta.solid.label.toLowerCase(),
  learning: statusMeta.learning.label.toLowerCase(),
  weak: "opakovat",
  new: "zatím ne",
};
const freshFill = (status: PointStatus) => `radial-gradient(circle, var(--color-sage-700) 0 1.6px, ${FILL[status]} 2.1px)`;

export function KnowledgeMap({ points, states, now }: { points: PointWithTopic[]; states: Map<string, PointState>; now: Date }) {
  const today = dayKey(now);
  const beds = new Map<string, { id: string; status: PointStatus; fresh: boolean }[]>();
  const counts: Record<PointStatus, number> = { solid: 0, learning: 0, weak: 0, new: 0 };
  for (const p of points) {
    if (p.tier === "C") continue;
    const st = states.get(p.id);
    const status = pointStatus(st, p);
    counts[status]++;
    const bed = beds.get(p.topicId) ?? [];
    bed.push({ id: p.id, status, fresh: !!st?.introducedAt && dayKey(st.introducedAt) === today });
    beds.set(p.topicId, bed);
  }
  let freshIndex = 0;
  const blocks = [...beds.entries()].map(([topicId, cells]) => {
    const sorted = [...cells].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
    const seen = cells.filter((c) => c.status !== "new").length;
    return { topicId, title: `${topicsById.get(topicId)?.title ?? topicId}: ${seen} z ${cells.length}`, cells: sorted };
  });
  const fresh = blocks.reduce((n, b) => n + b.cells.filter((c) => c.fresh).length, 0);
  const label =
    `Mapa poznatků po tématech: ${counts.solid} ${LEGEND_LABEL.solid}, ${counts.learning} ${LEGEND_LABEL.learning}, ` +
    `${counts.weak} k opakování, ${counts.new} zatím neprobráno` +
    (fresh ? `; z toho ${fresh} dnes ${plural(fresh, "nový", "nové", "nových", false)}.` : ".");

  return (
    <div className="flex flex-col gap-3.5">
      <div role="img" aria-label={label} className="flex flex-wrap items-start gap-2.5 sm:gap-x-3.5 sm:gap-y-3">
        {blocks.map((b) => (
          <span key={b.topicId} title={b.title} className="grid auto-cols-[7px] grid-flow-col grid-rows-[repeat(4,7px)] gap-[2px] sm:auto-cols-[8px] sm:grid-rows-[repeat(4,8px)]">
            {b.cells.map((c) => {
              const style: CSSProperties = { background: c.fresh ? freshFill(c.status) : FILL[c.status] };
              if (c.fresh) style.animationDelay = `${250 + freshIndex++ * 70}ms`;
              return <span key={c.id} className={c.fresh ? "rounded-[2px] animate-sprout" : "rounded-[2px]"} style={style} />;
            })}
          </span>
        ))}
      </div>
      <div aria-hidden className="flex flex-col gap-2 text-[12.5px] text-faint sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:text-[13px]">
        <span className="grid grid-cols-[repeat(2,max-content)] gap-x-6 gap-y-1.5 sm:flex sm:flex-wrap sm:gap-x-4">
          {ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-2 w-2 flex-none rounded-[2px] sm:h-[9px] sm:w-[9px]" style={{ background: FILL[s] }} />
              {counts[s]} {LEGEND_LABEL[s]}
            </span>
          ))}
        </span>
        {fresh > 0 && (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 flex-none rounded-[2px] sm:h-[9px] sm:w-[9px]" style={{ background: freshFill("learning") }} />z toho {fresh} dnes{" "}
            {plural(fresh, "nový", "nové", "nových", false)}
          </span>
        )}
      </div>
    </div>
  );
}
