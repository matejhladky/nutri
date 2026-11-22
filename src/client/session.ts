/**
 * The current study session, persisted in localStorage so a reload (or closing the phone) resumes
 * exactly where she left off — same card, same generated numbers, same option order.
 */
import type { NextCard, SessionItem } from "@/engine/planner";
import type { CaseStepResponse, Evaluation, Outcome, Response } from "@/engine/types";
import { dayKey } from "@/engine/time";

export type StudyMode = { kind: "daily" } | { kind: "topic"; topicId: string };

/** The recorded answer to the card on screen — a reload shows its feedback instead of asking again. */
export type AnsweredCard = { eventId: string; response: Response; evaluation: Evaluation; hintUsed: boolean };
/** A finished step of a client case (cases are recorded only when complete). */
export type CaseStepDone = { response: CaseStepResponse; outcome: Outcome; summary: string };

export type CardInstance = {
  next: Exclude<NextCard, { kind: "done" }>;
  /** Seeds numeric parameters and option shuffling. */
  seed: number;
  shownAt: string;
  answer?: AnsweredCard;
  caseSteps?: CaseStepDone[];
};

export type StoredSession = {
  day: string;
  mode: StudyMode;
  history: SessionItem[];
  current: CardInstance | null;
  beyondGoal: boolean;
};

const KEY = "nutri.session.v1";
const sameMode = (a: StudyMode, b: StudyMode) =>
  a.kind === b.kind && (a.kind === "daily" || (b.kind === "topic" && a.topicId === b.topicId));

export function loadSession(mode: StudyMode, now = new Date()): StoredSession {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as StoredSession | null;
    if (s && s.day === dayKey(now) && sameMode(s.mode, mode)) return s;
  } catch {
    /* ignore corrupt session */
  }
  return { day: dayKey(now), mode, history: [], current: null, beyondGoal: false };
}

export function saveSession(s: StoredSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
