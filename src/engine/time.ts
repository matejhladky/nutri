/**
 * Study-day arithmetic. A study day runs 04:00–04:00 Europe/Prague, so late-evening sessions
 * count towards the same day (Anki-style day boundary).
 */
const TZ = "Europe/Prague";
const DAY_START_HOUR = 4;

/** "YYYY-MM-DD" of the study day containing the instant. */
export function dayKey(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const shifted = new Date(d.getTime() - DAY_START_HOUR * 3600_000);
  return shifted.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** Whole study days from a to b (b − a), using day keys. */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);
}

/** Study days left before the exam, counting today; 0 on/after exam day. examDate is "YYYY-MM-DD". */
export function daysUntilExam(now: Date, examDate: string): number {
  return Math.max(0, dayDiff(dayKey(now), examDate));
}

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400_000);
