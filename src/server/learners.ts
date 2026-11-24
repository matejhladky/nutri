/**
 * Learner configuration from the environment:
 *   LEARNER_1_PASSPHRASE / LEARNER_1_NAME (default "Lucko") / LEARNER_1_EXAM_DATE (default EXAM_DATE)
 *   LEARNER_2_PASSPHRASE / LEARNER_2_NAME (default "Dančo") / LEARNER_2_EXAM_DATE (default EXAM_DATE)
 *   LEARNER_n_LABEL — her name as the admin area shows it (nominative: "Lucka", "Danča"; NAME is the vocative)
 * A learner without a passphrase cannot log in, and her existing sessions stop working.
 */
import { EXAM_DATE } from "@/lib/exam";
import type { Learner, LearnerId } from "@/lib/learner";

const PREFIX: Record<LearnerId, string> = { l1: "LEARNER_1", l2: "LEARNER_2" };
const DEFAULT_NAME: Record<LearnerId, string> = { l1: "Lucko", l2: "Dančo" };

const env = (id: LearnerId, key: string) => process.env[`${PREFIX[id]}_${key}`]?.trim() || undefined;

export const learnerPassphrase = (id: LearnerId): string | undefined => env(id, "PASSPHRASE");

const DEFAULT_LABEL: Record<LearnerId, string> = { l1: "Lucka", l2: "Danča" };
export const learnerLabel = (id: LearnerId): string => env(id, "LABEL") ?? DEFAULT_LABEL[id];

export function getLearner(id: LearnerId): Learner {
  const date = env(id, "EXAM_DATE");
  return {
    id,
    name: env(id, "NAME") ?? DEFAULT_NAME[id],
    examDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : EXAM_DATE,
  };
}
