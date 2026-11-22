"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PointWithTopic } from "@/content/schema";
import { useStudy } from "@/client/store";
import { pagesLabel } from "@/lib/content";
import { Button } from "../ui";

/** Global keyboard shortcuts, ignored while typing in a text field (except keys listed in allowInInputs). */
export function useKeys(map: Record<string, () => void>, enabled = true, allowInInputs: string[] = []) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing && !allowInInputs.includes(e.key)) return;
      const key = e.key === " " ? "Space" : e.key;
      const fn = ref.current[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, allowInInputs]);
}

export function SourceLine({ point }: { point: PointWithTopic }) {
  return <div className="text-xs text-faint">Skripta {pagesLabel(point.source.pages)}</div>;
}

/** "Pozn." for course-disputed / supplementary points. */
export function NoteBox({ point }: { point: PointWithTopic }) {
  if (!point.note) return null;
  const label = point.status === "supplementary" ? "Doplněk mimo skripta" : "Pozor, nejednoznačné";
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] leading-snug">
      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-600">{label}</div>
      {point.note}
    </div>
  );
}

export function ReportLink({ pointId, exerciseId }: { pointId: string; exerciseId: string | null }) {
  const { report } = useStudy();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (state === "sent") return <p className="text-xs text-faint">Díky! Otázka je skrytá, dokud ji neopravím.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-faint underline-offset-4 hover:text-muted hover:underline">
        Nahlásit problém s otázkou
      </button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
      <label className="text-sm font-medium" htmlFor="report-msg">
        Co je špatně? (nepovinné)
      </label>
      <textarea
        id="report-msg"
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="rounded-xl border border-line-strong bg-paper px-3 py-2 text-[15px] outline-none focus:border-sage-500"
        placeholder="Např. odpověď neodpovídá skriptům, otázka je nejasná…"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={state === "sending"}
          onClick={async () => {
            setState("sending");
            try {
              await report({ pointId, exerciseId, message });
              setState("sent");
            } catch {
              setState("error");
            }
          }}
        >
          Odeslat a skrýt otázku
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Zrušit
        </Button>
      </div>
      {state === "error" && <p className="text-xs text-clay-600">Nepodařilo se odeslat. Zkus to znovu.</p>}
    </div>
  );
}

export type Verdict = "correct" | "partial" | "wrong" | "unknown";

const verdictStyle: Record<Verdict, { label: string; cls: string }> = {
  correct: { label: "Správně", cls: "bg-sage-50 text-sage-700" },
  partial: { label: "Částečně", cls: "bg-amber-50 text-amber-600" },
  wrong: { label: "Tentokrát ne", cls: "bg-clay-50 text-clay-600" },
  unknown: { label: "Nevadí — tady je odpověď", cls: "bg-paper text-muted border border-line" },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = verdictStyle[verdict];
  return <div className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${v.cls}`}>{v.label}</div>;
}

/** Feedback footer: point explanation, note, source, report link, Next button. */
export function FeedbackFooter({
  point,
  exerciseId,
  onNext,
  showExplanation = true,
  children,
}: {
  point: PointWithTopic;
  exerciseId: string;
  onNext: () => void;
  showExplanation?: boolean;
  children?: ReactNode;
}) {
  useKeys({ Enter: onNext });
  return (
    <div className="flex flex-col gap-4 animate-rise">
      {children}
      {showExplanation && (
        <div className="rounded-2xl bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink/90">
          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-faint">Výklad</div>
          {point.explanation}
        </div>
      )}
      <NoteBox point={point} />
      <div className="flex items-center justify-between gap-3">
        <SourceLine point={point} />
        <ReportLink pointId={point.id} exerciseId={exerciseId} />
      </div>
      <Button size="lg" onClick={onNext} kbd="↵" autoFocus>
        Další
      </Button>
    </div>
  );
}
