import "server-only";
/**
 * Admin area: who may see it, and the read-only data it shows. Learner data is read through `readOnly(db)`, so no
 * admin page can write events, point state, settings or reports — whatever the code above it does.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LEARNER_IDS, type LearnerId } from "@/lib/learner";
import type { PointState } from "@/engine/types";
import { getDb, readOnly } from "./db";
import { getLearner, learnerLabel, learnerPassphrase } from "./learners";
import { ADMIN_COOKIE, verifyAdminToken } from "./session";
import { getAnswersByDay, getSettings, listReports, readStates, type ReportRow, type Settings } from "./store";

/** For admin pages and layouts: redirect to the admin login unless this is an admin session. */
export async function requireAdmin(): Promise<void> {
  if (!(await verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value))) redirect("/admin/login");
}

/** Learners that can log in (have a passphrase), for the admin's switcher. */
export const adminLearners = () => LEARNER_IDS.filter((id) => learnerPassphrase(id)).map((id) => ({ id, label: learnerLabel(id) }));

export type LearnerOverviewData = {
  id: LearnerId;
  label: string;
  examDate: string;
  settings: Settings;
  states: Record<string, PointState>;
  answersByDay: Record<string, number>;
  reports: ReportRow[];
  now: string;
};

export async function learnerOverview(id: LearnerId, now = new Date()): Promise<LearnerOverviewData> {
  const db = readOnly(await getDb());
  const [states, settings, answersByDay, reports] = await Promise.all([
    readStates(id, db),
    getSettings(id, db),
    getAnswersByDay(id, now, 14, db),
    listReports(id, db),
  ]);
  return { id, label: learnerLabel(id), examDate: getLearner(id).examDate, settings, states, answersByDay, reports, now: now.toISOString() };
}
