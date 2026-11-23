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
import { enqueue, flush, pendingEvents, UnauthorizedError } from "./outbox";

export type Settings = { dailyMinutes: number };
export type Report = { pointId: string; exerciseId: string | null };

type Store = {
  status: "loading" | "ready" | "error";
  error: string | null;
  states: Map<string, PointState>;
  /** Latest states, synchronously updated by record() — use inside event handlers. */
  getStates: () => Map<string, PointState>;
  settings: Settings;
  points: PointWithTopic[];
  pending: number;
  syncError: boolean;
  todayCards: number;
  timing: Timing;
  record: (ev: StudyEvent) => void;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  report: (r: Report & { message: string }) => Promise<void>;
  retrievability: (st: PointState, now: Date) => number;
  reload: () => void;
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

/** Answers given today that the server does not know about yet (still in the outbox). */
const pendingAnswersToday = () => {
  const today = dayKey(new Date());
  return pendingEvents().filter((e) => e.kind === "answer" && dayKey(e.at) === today).length;
};

export function StudyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toLogin = useCallback(() => router.replace("/login"), [router]);
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
  const [todayCards, setTodayCards] = useState(0);
  const sched = useRef<Scheduler | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /** Merge authoritative server states, re-applying still-pending local events on top. */
  const merge = useCallback((server: Record<string, PointState>) => {
    const s = sched.current;
    if (!s) return;
    const queued = pendingEvents();
    setStates((prev) => {
      const next = new Map(prev);
      for (const [id, st] of Object.entries(server)) {
        let cur: PointState | undefined = st;
        for (const ev of queued.filter((e) => e.pointId === id)) cur = applySafely(cur, ev, s);
        next.set(id, cur!);
      }
      return next;
    });
  }, [setStates]);

  const sync = useCallback(async () => {
    try {
      const fresh = await flush();
      merge(fresh);
      setSyncError(false);
    } catch (e) {
      if (e instanceof UnauthorizedError) return toLogin();
      setSyncError(true);
    } finally {
      setPending(pendingEvents().length);
    }
  }, [merge, toLogin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getScheduler();
        sched.current = s;
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.status === 401) return toLogin();
        if (!res.ok) throw new Error(`Server odpověděl ${res.status}`);
        const data = (await res.json()) as {
          states: Record<string, PointState>;
          settings: Settings;
          reports: Report[];
          timing?: Timing;
          todayAnswers?: number;
        };
        if (cancelled) return;
        const map = new Map(Object.entries(data.states));
        // Apply events not yet confirmed by the server (offline answers, closed tab mid-sync).
        for (const ev of [...pendingEvents()].sort((a, b) => a.at.localeCompare(b.at))) {
          map.set(ev.pointId, applySafely(map.get(ev.pointId), ev, s));
        }
        setStates(() => map);
        setSettings(data.settings);
        setReports(data.reports);
        setTiming(data.timing ?? {});
        // Today's answers = stored on the server (any device) + still queued here.
        setTodayCards((data.todayAnswers ?? 0) + pendingAnswersToday());
        setPending(pendingEvents().length);
        setStatus("ready");
        void sync();
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sync, reloadKey, setStates, toLogin]);

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
      enqueue(ev);
      setStates((prev) => new Map(prev).set(ev.pointId, applySafely(prev.get(ev.pointId), ev, s)));
      setPending(pendingEvents().length);
      if (ev.kind === "answer") setTodayCards((n) => n + 1); // answers only — reading an explanation is not an answer
      void sync();
    },
    [sync, setStates],
  );

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.status === 401) return toLogin();
    if (!res.ok) throw new Error("Nastavení se nepodařilo uložit.");
    setSettings(((await res.json()) as { settings: Settings }).settings);
  }, [toLogin]);

  /** Send a report; the item is hidden only once the server has stored it. Throws if it was not stored. */
  const report = useCallback(async (r: Report & { message: string }) => {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(r),
    });
    if (res.status === 401) {
      toLogin();
      throw new Error("Nejsi přihlášená.");
    }
    if (!res.ok) throw new Error("Hlášení se nepodařilo odeslat.");
    setReports((prev) => [...prev, { pointId: r.pointId, exerciseId: r.exerciseId }]);
  }, [toLogin]);

  const retrievability = useCallback(
    (st: PointState, now: Date) => (sched.current ? fsrsRetrievability(sched.current, st.card, now) : 0),
    [],
  );

  const points = useMemo(() => visiblePoints(reports), [reports]);

  const value: Store = {
    status,
    error,
    states,
    getStates: () => statesRef.current,
    settings,
    points,
    pending,
    syncError,
    todayCards,
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
