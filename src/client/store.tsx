"use client";
/**
 * Client learner store: server state + optimistic local application of events.
 * Events go to the durable outbox first, are applied locally with the same reducer as the server,
 * and server responses (authoritative) are merged with any still-pending local events re-applied on top.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getScheduler, retrievability as fsrsRetrievability, type Scheduler } from "@/engine/scheduler";
import { applyEvent, emptyState } from "@/engine/state";
import type { PointState, StudyEvent } from "@/engine/types";
import { dayKey } from "@/engine/time";
import { visiblePoints } from "@/lib/content";
import type { PointWithTopic } from "@/content/schema";
import type { Timing } from "@/engine/planner";
import type { Learner } from "@/lib/learner";
import { adoptLegacyStorage } from "./learner-storage";
import { apiFetch, enqueue, flush, LearnerChangedError, pendingEvents, UnauthorizedError } from "./outbox";

export type Settings = { dailyMinutes: number };
export type Report = { pointId: string; exerciseId: string | null };

type Store = {
  /** The signed-in learner (from the session cookie, rendered by the server). */
  learner: Learner;
  status: "loading" | "ready" | "error";
  error: string | null;
  states: Map<string, PointState>;
  /** Latest states, synchronously updated by record() — use inside event handlers. */
  getStates: () => Map<string, PointState>;
  settings: Settings;
  points: PointWithTopic[];
  pending: number;
  syncError: boolean;
  /** Answers given in the current study day (server log from any device + still queued here). */
  todayCards: number;
  /** Answers per study day ("YYYY-MM-DD"), last 14 days; same sources as todayCards. Days without answers are absent. */
  answersByDay: Record<string, number>;
  timing: Timing;
  record: (ev: StudyEvent) => void;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  report: (r: Report & { message: string }) => Promise<void>;
  retrievability: (st: PointState, now: Date) => number;
  reload: () => void;
  /** Admin preview: a disposable store — nothing is queued, sent or stored (see PreviewProvider). */
  preview?: true;
};

const Ctx = createContext<Store | null>(null);

export function useStudy(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStudy must be used inside <StudyProvider>");
  return s;
}

/**
 * Apply a queued event to local state, skipping one that cannot be applied (e.g. malformed, from an older client)
 * instead of failing the whole app load. The outbox still sends it; the server rejects it and the outbox drops it.
 */
function applySafely(prev: PointState | undefined, ev: StudyEvent, s: Scheduler): PointState {
  try {
    return applyEvent(prev, ev, s);
  } catch (e) {
    console.warn("Skipping a queued event that cannot be applied", ev.id, e);
    return prev ?? emptyState(ev.pointId);
  }
}

/** Add answers the server does not know about yet (still in the outbox) to its per-day counts. */
const withPending = (server: Record<string, number>, learner: Learner["id"]) => {
  const out = { ...server };
  for (const e of pendingEvents(learner)) if (e.kind === "answer") out[dayKey(e.at)] = (out[dayKey(e.at)] ?? 0) + 1;
  return out;
};

/** The session on this device switched to the other learner: reload so the page is rendered for her (her data only). */
const reloadAsCurrentLearner = () => window.location.replace("/");

export function StudyProvider({ learner, children }: { learner: Learner; children: ReactNode }) {
  const router = useRouter();
  const toLogin = useCallback(() => router.replace("/login"), [router]);
  const me = learner.id;
  const [status, setStatus] = useState<Store["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [states, setStatesRaw] = useState<Map<string, PointState>>(new Map());
  const statesRef = useRef(states);
  /** Keep the ref and React state in lock-step. */
  const setStates = useCallback((update: (prev: Map<string, PointState>) => Map<string, PointState>) => {
    statesRef.current = update(statesRef.current);
    setStatesRaw(statesRef.current);
  }, []);
  const [settings, setSettings] = useState<Settings>({ dailyMinutes: 45 });
  const [reports, setReports] = useState<Report[]>([]);
  /** Her observed timing (server-computed); empty until enough answers exist — the planner then uses its defaults. */
  const [timing, setTiming] = useState<Timing>({});
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState(false);
  const [answersByDay, setAnswersByDay] = useState<Record<string, number>>({});
  const sched = useRef<Scheduler | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /** Merge authoritative server states, re-applying still-pending local events on top. */
  const merge = useCallback((server: Record<string, PointState>) => {
    const s = sched.current;
    if (!s) return;
    const queued = pendingEvents(me);
    setStates((prev) => {
      const next = new Map(prev);
      for (const [id, st] of Object.entries(server)) {
        let cur: PointState | undefined = st;
        for (const ev of queued.filter((e) => e.pointId === id)) cur = applySafely(cur, ev, s);
        next.set(id, cur!);
      }
      return next;
    });
  }, [setStates, me]);

  const sync = useCallback(async () => {
    try {
      const fresh = await flush(me);
      merge(fresh);
      setSyncError(false);
    } catch (e) {
      if (e instanceof UnauthorizedError) return toLogin();
      if (e instanceof LearnerChangedError) return reloadAsCurrentLearner();
      setSyncError(true);
    } finally {
      setPending(pendingEvents(me).length);
    }
  }, [merge, toLogin, me]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        adoptLegacyStorage(me);
        const s = await getScheduler();
        sched.current = s;
        const res = await apiFetch(me, "/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`Server odpověděl ${res.status}`);
        const data = (await res.json()) as {
          states: Record<string, PointState>;
          settings: Settings;
          reports: Report[];
          timing?: Timing;
          answersByDay?: Record<string, number>;
        };
        if (cancelled) return;
        const map = new Map(Object.entries(data.states));
        // Apply events not yet confirmed by the server (offline answers, closed tab mid-sync).
        for (const ev of [...pendingEvents(me)].sort((a, b) => a.at.localeCompare(b.at))) {
          map.set(ev.pointId, applySafely(map.get(ev.pointId), ev, s));
        }
        setStates(() => map);
        setSettings(data.settings);
        setReports(data.reports);
        setTiming(data.timing ?? {});
        // Today's answers = stored on the server (any device) + still queued here.
        setAnswersByDay(withPending(data.answersByDay ?? {}, me));
        setPending(pendingEvents(me).length);
        setStatus("ready");
        void sync();
      } catch (e) {
        if (e instanceof UnauthorizedError) return toLogin();
        if (e instanceof LearnerChangedError) return reloadAsCurrentLearner();
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sync, reloadKey, setStates, toLogin, me]);

  // Retry sync periodically while something is pending, and when the connection returns.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void sync(), 15_000);
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", online);
    };
  }, [pending, sync]);

  const record = useCallback(
    (ev: StudyEvent) => {
      const s = sched.current;
      if (!s) return;
      enqueue(me, ev);
      setStates((prev) => new Map(prev).set(ev.pointId, applySafely(prev.get(ev.pointId), ev, s)));
      setPending(pendingEvents(me).length);
      // Answers only — reading an explanation is not an answer.
      if (ev.kind === "answer") setAnswersByDay((m) => ({ ...m, [dayKey(ev.at)]: (m[dayKey(ev.at)] ?? 0) + 1 }));
      void sync();
    },
    [sync, setStates, me],
  );

  /** API call on behalf of this page's learner; a signed-out or switched session leaves the page instead of resolving. */
  const call = useCallback(
    async (path: string, body: unknown): Promise<Response> => {
      try {
        return await apiFetch(me, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      } catch (e) {
        if (e instanceof UnauthorizedError) toLogin();
        if (e instanceof LearnerChangedError) reloadAsCurrentLearner();
        throw e;
      }
    },
    [me, toLogin],
  );

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const res = await call("/api/settings", patch);
    if (!res.ok) throw new Error("Nastavení se nepodařilo uložit.");
    setSettings(((await res.json()) as { settings: Settings }).settings);
  }, [call]);

  /** Send a report; the item is hidden only once the server has stored it. Throws if it was not stored. */
  const report = useCallback(async (r: Report & { message: string }) => {
    const res = await call("/api/reports", r).catch(() => {
      throw new Error("Hlášení se nepodařilo odeslat.");
    });
    if (!res.ok) throw new Error("Hlášení se nepodařilo odeslat.");
    setReports((prev) => [...prev, { pointId: r.pointId, exerciseId: r.exerciseId }]);
  }, [call]);

  const retrievability = useCallback(
    (st: PointState, now: Date) => (sched.current ? fsrsRetrievability(sched.current, st.card, now) : 0),
    [],
  );

  const points = useMemo(() => visiblePoints(reports), [reports]);

  const value: Store = {
    learner,
    status,
    error,
    states,
    getStates: () => statesRef.current,
    settings,
    points,
    pending,
    syncError,
    todayCards: answersByDay[dayKey(new Date())] ?? 0,
    answersByDay,
    timing,
    record,
    saveSettings,
    report,
    retrievability,
    reload: () => {
      setStatus("loading");
      setReloadKey((k) => k + 1);
    },
  };
  return <Ctx value={value}>{children}</Ctx>;
}

const noNetwork = () => Promise.reject(new Error("V náhledu se nic neukládá."));

/**
 * Sandbox for the admin's exercise preview: the real study cards with a store that has no learner data and no way
 * out — `record` keeps nothing, settings and reports are refused, and no request is ever made.
 */
export function PreviewProvider({ examDate, children }: { examDate: string; children: ReactNode }) {
  const empty = useMemo(() => new Map<string, PointState>(), []);
  const value: Store = {
    learner: { id: "l1", name: "", examDate },
    status: "ready",
    error: null,
    states: empty,
    getStates: () => empty,
    settings: { dailyMinutes: 45 },
    points: visiblePoints([]),
    pending: 0,
    syncError: false,
    todayCards: 0,
    answersByDay: {},
    timing: {},
    record: () => {},
    saveSettings: noNetwork,
    report: noNetwork,
    retrievability: () => 0,
    reload: () => {},
    preview: true,
  };
  return <Ctx value={value}>{children}</Ctx>;
}
