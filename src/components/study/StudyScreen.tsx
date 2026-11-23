"use client";
import { EXAM_DATE } from "@/lib/exam";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStudy } from "@/client/store";
import { loadSession, newSeed, saveSession, uuid, type StoredSession, type StudyMode } from "@/client/session";
import { dailyPlan, nextCard, pickExercise, type NextCard, type SessionItem } from "@/engine/planner";
import { topicsById, withoutReported } from "@/lib/content";
import type { PointWithTopic } from "@/content/schema";
import { plural } from "@/lib/format";
import { Button, Icon, Spinner } from "../ui";
import { ExerciseCard, type AnswerRecord } from "./ExerciseCard";
import { IntroCard } from "./IntroCard";
import { ReportedContext } from "./shared";

type Done = Extract<NextCard, { kind: "done" }>;

type ScreenState = { session: StoredSession; done: Done | null };

export function StudyScreen({ mode, beyondGoal }: { mode: StudyMode; beyondGoal: boolean }) {
  const { getStates, settings, points, record, retrievability, todayCards, syncError, states, timing } = useStudy();
  const exitHref = mode.kind === "topic" ? `/temata/${mode.topicId}` : "/";
  const pointsById = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);

  /** Pure transition: fill `current` with the planner's next card, or mark the session done. */
  const fill = (session: StoredSession, pts: PointWithTopic[] = points): ScreenState => {
    const cur = session.current;
    if (cur) {
      const p = pointsById.get(cur.next.pointId);
      const stillThere = p && (cur.next.kind === "intro" || p.exercises.some((e) => e.id === (cur.next as { exerciseId: string }).exerciseId));
      if (stillThere) return { session, done: null };
    }
    const now = new Date();
    const n = nextCard({
      now,
      examDate: EXAM_DATE,
      points: pts,
      states: getStates(),
      session: session.history,
      mode,
      beyondGoal: session.beyondGoal,
      dailyMinutes: settings.dailyMinutes,
      retrievability,
      timing,
    });
    if (n.kind === "done") return { session: { ...session, current: null }, done: n };
    return { session: { ...session, current: { next: n, seed: newSeed(), shownAt: now.toISOString() } }, done: null };
  };

  // Mounted only once the store is ready (AppFrame shows a spinner before), so localStorage is available.
  const [screen, setScreen] = useState<ScreenState>(() => {
    const s = loadSession(mode);
    if (beyondGoal) s.beyondGoal = true;
    return fill(s);
  });
  const { session, done } = screen;


  // Persist the session (external system sync).
  useEffect(() => saveSession(session), [session]);

  const advance = (item: SessionItem) => setScreen(fill({ ...session, current: null, history: [...session.history, item] }));

  const current = session.current;
  const point = current ? pointsById.get(current.next.pointId) : undefined;

  const plan = useMemo(
    () => dailyPlan({ now: new Date(), examDate: EXAM_DATE, points, states, dailyMinutes: settings.dailyMinutes, retrievability, timing }),
    [settings, points, states, retrievability, timing],
  );

  const onIntroDone = (skipped: boolean) => {
    if (!point) return;
    record({ id: uuid(), pointId: point.id, at: new Date().toISOString(), kind: "intro", skippedIntro: skipped || undefined });
    if (skipped) {
      // Ask right away instead of after the usual gap.
      const ex = pickExercise(point.exercises, undefined);
      setScreen({
        done: null,
        session: {
          ...session,
          history: [...session.history, { pointId: point.id, kind: "intro", isNew: true }],
          current: { next: { kind: "exercise", pointId: point.id, exerciseId: ex.id, reason: "learning" }, seed: newSeed(), shownAt: new Date().toISOString() },
        },
      });
    } else advance({ pointId: point.id, kind: "intro", isNew: true });
  };

  /** Persist the session now (not in the effect), in the same task as the event is queued: no reload can fall between. */
  /** Persist the session now (not in the effect), in the same task as the event is queued: no reload can fall between. */
  const commit = (next: StoredSession) => {
    saveSession(next);
    setScreen({ done: null, session: next });
  };

  /** The current item was just reported (and hidden): move on without recording anything for it. */
  const onReported = (r: { pointId: string; exerciseId: string | null }) => {
    if (!current) return;
    const next = current.next;
    const isNew = next.kind === "exercise" && next.reason === "new";
    const item: SessionItem = { pointId: next.pointId, kind: next.kind === "intro" ? "intro" : "exercise", isNew };
    // Plan with the reported item already excluded — `points` from this render does not know about the report yet.
    setScreen(fill({ ...session, current: null, history: [...session.history, item] }, withoutReported(points, r)));
  };

  const onRecord = (a: AnswerRecord) => {
    if (!point || !current || current.answer) return; // a card is graded at most once, also after a reload
    const eventId = uuid();
    const answer = { eventId, response: a.response, evaluation: a.evaluation, hintUsed: a.hintUsed };
    commit({ ...session, current: { ...current, answer, caseSteps: a.caseSteps ?? current.caseSteps } });
    record({
      id: eventId,
      pointId: point.id,
      at: new Date().toISOString(),
      kind: "answer",
      exerciseId: a.exerciseId,
      exerciseVersion: a.exerciseVersion,
      exerciseType: point.exercises.find((e) => e.id === a.exerciseId)?.type,
      outcome: a.evaluation.outcome,
      grade: a.evaluation.grade,
      hintUsed: a.hintUsed || undefined,
      response: a.response,
      durationMs: a.durationMs,
    });
  };

  const total = todayCards + plan.dueReviews + plan.learningDue + Math.max(0, plan.newTarget - plan.newToday) * 2;
  const progress = mode.kind === "daily" && total > 0 ? Math.min(1, todayCards / total) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-3 py-2.5 md:px-6 md:py-4">
          <Link
            href={exitHref}
            className="flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-[15px] text-muted hover:bg-ink/[0.04] hover:text-ink"
            aria-label="Ukončit studium"
          >
            <Icon name="close" />
            <span className="hidden md:inline">Ukončit</span>
          </Link>
          <div className="mx-auto w-full max-w-[680px] flex-1">
            {progress !== null ? (
              <div className="h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Dnešní plán">
                <div className="h-full rounded-full bg-sage-600 transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
              </div>
            ) : (
              <div className="truncate text-center text-[15px] font-medium text-muted">{mode.kind === "topic" ? topicsById.get(mode.topicId)?.title : ""}</div>
            )}
          </div>
          <div className="min-w-10 px-2 text-right text-[13px] tabular-nums text-faint md:min-w-24" title="Odpovědí dnes">
            {todayCards}
            <span className="hidden md:inline"> {plural(todayCards, "odpověď", "odpovědi", "odpovědí", false)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-5 pt-6 pb-32 md:px-5 md:pt-12 md:pb-20">
        {done ? (
          <DoneView
            done={done}
            mode={mode}
            todayCards={todayCards}
            exitHref={exitHref}
            canContinue={mode.kind === "daily" && (plan.remainingNew > 0 || states.size > 0)}
            sweepOnly={plan.remainingNew === 0 || (plan.daysLeft !== null && plan.daysLeft <= 2)}
            onContinue={() => setScreen(fill({ ...session, beyondGoal: true, current: null }))}
          />
        ) : !current || !point ? (
          <Spinner label="" />
        ) : current.next.kind === "intro" ? (
          <IntroCard key={`intro-${point.id}`} point={point} onDone={onIntroDone} />
        ) : (
          (() => {
            const exId = current.next.exerciseId;
            const exercise = point.exercises.find((e) => e.id === exId);
            if (!exercise) return <Spinner label="" />;
            return (
              <ReportedContext.Provider value={onReported}>
                <ExerciseCard
                  key={`${point.id}/${exercise.id}/${current.seed}`}
                  point={point}
                  exercise={exercise}
                  seed={current.seed}
                  reason={current.next.reason}
                  restored={current.answer}
                  caseSteps={current.caseSteps}
                  onCaseProgress={(steps) => commit({ ...session, current: { ...current, caseSteps: steps } })}
                  onRecord={onRecord}
                  onNext={() => advance({ pointId: point.id, kind: "exercise", isNew: current.next.kind === "exercise" && current.next.reason === "new" })}
                />
              </ReportedContext.Provider>
            );
          })()
        )}
      </main>
      {syncError && <p className="pb-4 text-center text-xs text-faint">Jsi offline — odpovědi se ukládají v zařízení.</p>}
    </div>
  );
}

function DoneView({
  done,
  mode,
  todayCards,
  exitHref,
  canContinue,
  sweepOnly,
  onContinue,
}: {
  done: Done;
  mode: StudyMode;
  todayCards: number;
  exitHref: string;
  canContinue: boolean;
  sweepOnly: boolean;
  onContinue: () => void;
}) {
  const topicDone = mode.kind === "topic";
  const reason = done.reason;
  const nextClock = done.nextAt
    ? new Date(done.nextAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" })
    : null;
  const title =
    reason === "wait" ? "Pro tuhle chvíli hotovo" : topicDone ? "Téma je pro teď procvičené" : reason === "goal-reached" ? "Dnešní plán je splněný" : "Pro dnešek je hotovo";
  const text =
    reason === "wait" && nextClock
      ? `Další krátké opakování bude připravené kolem ${nextClock}.`
      : topicDone
        ? "Další opakování přijdou v následujících dnech."
        : "Opakování s odstupem funguje líp než dlouhé biflování.";
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-6 py-10 animate-rise md:items-center md:text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-600 text-white" aria-hidden>
        <Icon name="check" size={22} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-[26px] font-medium leading-tight md:text-[30px]">{title}</h2>
        <p className="text-muted">
          {todayCards > 0 && <>Dnes {plural(todayCards, "odpověď", "odpovědi", "odpovědí")}. </>}
          {text}
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Link href={exitHref} className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-sage-600 px-5 font-semibold text-white hover:bg-sage-700">
          {topicDone ? "Zpět na téma" : "Zpět na přehled"}
        </Link>
        {canContinue && reason === "goal-reached" && (
          <Button variant="ghost" size="lg" onClick={onContinue}>
            {sweepOnly ? "Procvičit nejslabší místa" : "Přidat ještě pár nových"}
          </Button>
        )}
      </div>
    </div>
  );
}
