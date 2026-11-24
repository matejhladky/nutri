"use client";
/**
 * Recent study activity: answers per study day (from the event log, this learner only) and points first met.
 * Understated on purpose — no goals, streaks or badges; just what she did.
 */
import type { PointWithTopic } from "@/content/schema";
import type { PointState } from "@/engine/types";
import { dayDiff, dayKey } from "@/engine/time";
import { plural } from "@/lib/format";

const WEEKDAY_SHORT = ["ne", "po", "út", "st", "čt", "pá", "so"];
const WEEKDAY_LONG = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

export type Day = { key: string; answers: number; weekday: number; date: string; ago: number };

/** The last `n` study days, oldest first, with zero-answer days filled in. */
export function recentDays(answersByDay: Record<string, number>, now: Date, n: number): Day[] {
  const today = dayKey(now);
  const t = Date.parse(`${today}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const ago = n - 1 - i;
    const d = new Date(t - ago * 86400_000);
    const key = d.toISOString().slice(0, 10);
    return { key, answers: answersByDay[key] ?? 0, weekday: d.getUTCDay(), date: `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`, ago };
  });
}

/** Points she met for the first time (intro or first answer) in the last 7 study days, today included. */
export function newPointsLastWeek(points: PointWithTopic[], states: Map<string, PointState>, now: Date): number {
  const today = dayKey(now);
  return points.filter((p) => {
    const at = states.get(p.id)?.introducedAt;
    if (!at) return false;
    const ago = dayDiff(dayKey(at), today);
    return ago >= 0 && ago < 7;
  }).length;
}

const dayName = (d: Day) => (d.ago === 0 ? "dnes" : d.ago === 1 ? "včera" : `${WEEKDAY_LONG[d.weekday]} ${d.date}`);
const answersText = (n: number) => plural(n, "odpověď", "odpovědi", "odpovědí");

/** "Za posledních 7 dní jsi odpověděla na 86 otázek, studovala 5 dní a poprvé prošla 23 poznatků." */
/** `self`: addressed to her ("jsi odpověděla"); otherwise about her, for the admin ("odpověděla"). */
export function WeekSummary({ days, newPoints, self = true }: { days: Day[]; newPoints: number; self?: boolean }) {
  const week = days.filter((d) => d.ago < 7);
  const answers = week.reduce((n, d) => n + d.answers, 0);
  const active = week.filter((d) => d.answers > 0).length;
  const em = (s: string) => <strong className="font-semibold text-sage-700">{s}</strong>;

  if (!answers && !newPoints) {
    return (
      <p className="max-w-xl font-serif text-[19px] leading-snug text-muted lg:text-[21px]">
        {days.some((d) => d.answers) ? "Poslední týden byl bez odpovědí." : "Tady uvidíš, kolik otázek denně zodpovíš."}
      </p>
    );
  }
  const parts = [
    <>odpověděla na {em(plural(answers, "otázku", "otázky", "otázek"))}</>,
    <>studovala {em(plural(active, "den", "dny", "dní"))}</>,
  ];
  if (newPoints) parts.push(<>poprvé prošla {em(plural(newPoints, "nový poznatek", "nové poznatky", "nových poznatků"))}</>);
  return (
    <p className="max-w-xl font-serif text-[19px] leading-snug lg:text-[21px]">
      Za posledních 7 dní {self ? "jsi " : ""}
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && (i === parts.length - 1 ? " a " : ", ")}
          {p}
        </span>
      ))}
      .
    </p>
  );
}

/** 14 quiet bars: the last 7 days (the period the sentence talks about) in full sage, the week before paler. */
export function ActivityChart({ days }: { days: Day[] }) {
  const max = Math.max(12, ...days.map((d) => d.answers)); // a couple of answers should not fill the chart
  return (
    <ol className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5 sm:gap-2.5" aria-label="Odpovědi za posledních 14 dní">
      {days.map((d) => {
        const recent = d.ago < 7;
        const today = d.ago === 0;
        const pct = (d.answers / max) * 100;
        return (
          <li key={d.key} className="flex flex-col items-center gap-2" title={`${dayName(d)}: ${answersText(d.answers)}`}>
            <span className="sr-only">
              {dayName(d)}: {answersText(d.answers)}
            </span>
            <div className="flex h-32 w-full flex-col items-center justify-end lg:h-40" aria-hidden>
              {d.answers > 0 && (
                <span className={`mb-1 text-[11.5px] leading-none tabular-nums ${recent ? "text-muted" : "text-faint"}`}>{d.answers}</span>
              )}
              <div
                className={`w-full max-w-9 rounded-t-[5px] rounded-b-[2px] ${
                  d.answers === 0 ? "bg-line-strong/70" : today ? "bg-sage-700" : recent ? "bg-sage-500" : "bg-sage-200"
                }`}
                style={{ height: d.answers === 0 ? 3 : `max(${pct * 0.85}%, 6px)` /* headroom for the number */ }}
              />
            </div>
            <span aria-hidden className={`text-[11.5px] leading-none ${today ? "font-semibold text-ink" : "text-faint"}`}>
              {WEEKDAY_SHORT[d.weekday]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
