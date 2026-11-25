/**
 * The teasing one-liner on Dnes comparing today's effort with the other learner (always on; friends joking).
 * Only effort is compared — plan done, answers today, answers over plan, study days this week — never accuracy or
 * topics. The first rule that applies wins (order matters). Numbers are always real.
 */
import { beforeStudyDayStarts } from "@/engine/time";
import { plural } from "./format";

export type DaySummary = {
  /** Answers given today (study day). */
  answers: number;
  /** Of those, answers given after today's plan was already complete. */
  extra: number;
  /** Today's plan is complete. */
  planDone: boolean;
  /** Days with at least one answer in the last 7 study days (today included). */
  days7: number;
};

/** The other learner as the server describes her: names and today's numbers, nothing else. */
export type Buddy = DaySummary & { label: string; labelWith: string };

/** behind = she leads (honey), ahead = you lead (green), even = level (outlined), both = both done. */
export type BuddyTone = "behind" | "ahead" | "even" | "both";
export type BuddyLine = { tone: BuddyTone; emoji: string; line1: string; line2: string };

/** "Nad plán" counts once there are at least this many extra answers. */
export const EXTRA_MIN = 10;
/** A smaller lead in answers is not reported, so the line doesn't flip back and forth. */
export const LEAD_MIN = 5;

const answers = (n: number) => plural(n, "odpověď", "odpovědi", "odpovědí");

/** Today's numbers zeroed (the week stays): a new calendar day that nobody has started yet. */
const freshDay = <T extends DaySummary>(d: T): T => ({ ...d, answers: 0, extra: 0, planDone: false });

/**
 * `now` matters between midnight and 04:00: the study day (and the plan card) still belong to yesterday, but the line
 * says "dneska", which reads as the new calendar day — so both start from zero then instead of comparing yesterday.
 */
export function buddyLine(meToday: DaySummary, herToday: Buddy, now = new Date()): BuddyLine {
  const night = beforeStudyDayStarts(now);
  const me = night ? freshDay(meToday) : meToday;
  const her = night ? freshDay(herToday) : herToday;
  const H = her.label;
  const meFire = me.extra >= EXTRA_MIN;
  const herFire = her.extra >= EXTRA_MIN;
  if (herFire && !meFire) return { tone: "behind", emoji: "🔥", line1: `${H} má dneska ${answers(her.extra)} nad plán.`, line2: "Je fakt locked in." };
  if (meFire && !herFire) return { tone: "ahead", emoji: "🔥", line1: `Máš dneska ${answers(me.extra)} nad plán.`, line2: `${H} by měla zbystřit.` };
  if (me.planDone && her.planDone) return { tone: "both", emoji: "🤝", line1: "Obě máte dnes hotovo. Remíza.", line2: "Zítra se uvidí." };
  if (her.planDone) return { tone: "behind", emoji: "😏", line1: `${H} už má pro dnešek hotovo.`, line2: "A ty?" };
  if (me.planDone) return { tone: "ahead", emoji: "😎", line1: `Máš hotovo dřív než ${H}.`, line2: "Klidně jí to otři o nos." };
  if (her.answers > 0 && me.answers === 0)
    return { tone: "behind", emoji: "👀", line1: `${H} už má dneska ${answers(her.answers)}.`, line2: "Ty zatím nula. Žádný stres." };
  const lead = me.answers - her.answers;
  if (-lead >= LEAD_MIN) return { tone: "behind", emoji: "🏃‍♀️", line1: `${H} ti dneska utíká o ${answers(-lead)}.`, line2: "Dá se to dohnat. Teoreticky." };
  if (lead > 0 && (lead >= LEAD_MIN || her.answers === 0))
    return { tone: "ahead", emoji: "🏆", line1: `Dneska vedeš o ${answers(lead)}.`, line2: `${H} to ještě neví.` };
  if (me.answers > 0) return { tone: "even", emoji: "⚖️", line1: `S ${her.labelWith} jste na tom dneska nastejno.`, line2: "Rozhoduje každá otázka." };
  if (her.days7 > me.days7)
    return {
      tone: "behind",
      emoji: "📅",
      line1: `Za poslední týden: ${H} ${plural(her.days7, "den", "dny", "dní")}, ty ${me.days7}.`,
      line2: "Dneska by to chtělo přidat.",
    };
  return { tone: "even", emoji: "🐢", line1: `${H} dneska ještě nezačala.`, line2: "Ideální chvíle ji předběhnout." };
}
