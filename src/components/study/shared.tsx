"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PointWithTopic } from "@/content/schema";
import { useStudy } from "@/client/store";
import { confusablesOf, pagesLabel } from "@/lib/content";
import { ActionBar, Button } from "../ui";

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
  return <span>Skripta {pagesLabel(point.source.pages)}</span>;
}

const NOTE_LABELS: [RegExp, string][] = [
  [/^Skripta$/i, "Skripta"],
  [/^Současné poznatky/i, "Současné poznatky"],
  [/^Ke zkoušce$/i, "Ke zkoušce"],
];

/** Split a three-part note ("Skripta: … Současné poznatky / předpisy: … Ke zkoušce: …"); null for a plain note. */
export function parseNote(note: string): { label: string; text: string }[] | null {
  const clean = note.replace(/\*\*/g, "");
  const re = /(Skripta|Současné poznatky(?:\s*\/\s*předpisy)?|Ke zkoušce)\s*:/g;
  const hits = [...clean.matchAll(re)];
  if (hits.length < 2 || clean.slice(0, hits[0].index).trim()) return null;
  return hits.map((m, i) => ({
    label: NOTE_LABELS.find(([r]) => r.test(m[1]))?.[1] ?? m[1],
    text: clean.slice(m.index! + m[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim(),
  }));
}

/** Note on a course-disputed / supplementary point: what the script says vs. current knowledge vs. the exam. */
export function NoteBox({ point }: { point: PointWithTopic }) {
  if (!point.note) return null;
  const title = point.status === "supplementary" ? "Nad rámec skript" : point.status === "course-disputed" ? "Skripta se tu liší" : "Poznámka";
  const parts = parseNote(point.note);
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-3.5 text-[15px] leading-relaxed text-[#3b3322] md:px-5">
      <p className="mb-1.5 font-semibold text-amber-700">{title}</p>
      {parts ? (
        <dl className="flex flex-col gap-2 sm:grid sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-x-4">
          {parts.map((p) => (
            <div key={p.label} className="contents">
              <dt className="text-[13.5px] font-medium text-amber-700 sm:pt-px">{p.label}</dt>
              <dd className="-mt-1.5 sm:mt-0">{p.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>{point.note.replace(/\*\*/g, "")}</p>
      )}
    </div>
  );
}

/**
 * Set by the study screen: called the moment an item is reported, so the session moves on instead of keeping a card
 * that the report has just hidden from the content bank.
 */
export const ReportedContext = createContext<((r: { pointId: string; exerciseId: string | null }) => void) | null>(null);

export function ReportLink({ pointId, exerciseId }: { pointId: string; exerciseId: string | null }) {
  const { report, preview } = useStudy();
  const onReported = useContext(ReportedContext);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const sending = useRef(false);

  if (preview) return null; // the admin preview reports nothing

  if (state === "sent") return <span>Díky, otázka je skrytá.</span>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="underline-offset-4 hover:text-ink hover:underline">
        Nahlásit chybu
      </button>
    );
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-line bg-card p-3 text-ink">
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
            if (sending.current) return;
            sending.current = true;
            setState("sending");
            try {
              await report({ pointId, exerciseId, message });
              // Stored on the server: hide it and, in a study session, move on (same update as the hide).
              setState("sent");
              onReported?.({ pointId, exerciseId });
            } catch {
              setState("error");
            } finally {
              sending.current = false;
            }
          }}
        >
          {state === "sending" ? "Odesílám…" : "Odeslat a skrýt otázku"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Zrušit
        </Button>
      </div>
      {state === "error" && (
        <p className="text-sm text-clay-600" role="alert">
          Hlášení se neodeslalo, otázka zůstává. Zkus to znovu.
        </p>
      )}
    </div>
  );
}

export type Verdict = "correct" | "partial" | "wrong" | "unknown";

const verdictStyle: Record<Verdict, { label: string; cls: string }> = {
  correct: { label: "Správně", cls: "text-sage-600" },
  partial: { label: "Částečně", cls: "text-amber-700" },
  wrong: { label: "Tentokrát ne", cls: "text-clay-600" },
  unknown: { label: "Tady je odpověď", cls: "text-muted" },
};

/** One coloured line that says how it went. */
export function VerdictBadge({ verdict, children }: { verdict: Verdict; children?: ReactNode }) {
  const v = verdictStyle[verdict];
  return (
    <p className={`text-[15.5px] font-semibold ${v.cls}`}>
      {v.label}
      {children && <span className="font-normal text-muted"> — {children}</span>}
    </p>
  );
}

/** Reading text: explanations, answers. */
export function Reading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-serif text-[17px] leading-[1.65] text-ink/90 md:text-[17.5px] ${className}`}>{children}</div>;
}

/** "Nezaměň s …": contrast with confusable points she has already met. */
function ContrastBox({ point }: { point: PointWithTopic }) {
  const { states } = useStudy();
  const known = confusablesOf(point.id).filter((q) => states.get(q.id)?.introducedAt);
  if (!known.length) return null;
  return (
    <div className="text-[15px] leading-snug">
      <p className="mb-1.5 font-semibold text-muted">Nezaměň s</p>
      <ul className="flex flex-col gap-2">
        {known.map((q) => (
          <li key={q.id}>
            <span className="font-medium">{q.title}</span>
            <span className="text-muted"> — {firstSentence(q.explanation)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const firstSentence = (s: string) => {
  const m = s.match(/^.{30,}?[.!?](?=\s|$)/); // ≥ 30 chars so an abbreviation like "např." doesn't cut it short
  return m ? m[0] : s;
};

/** Source page + report link: one quiet line. */
export function MetaLine({ point, exerciseId }: { point: PointWithTopic; exerciseId: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13.5px] text-faint">
      <SourceLine point={point} />
      <ReportLink pointId={point.id} exerciseId={exerciseId} />
    </div>
  );
}

/** After an answer: verdict and details (children), explanation, contrast, note, source; "Další" in the action bar. */
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
    <div className="flex flex-col gap-5 border-t border-line pt-5 animate-rise">
      {children}
      {showExplanation && <Reading>{point.explanation}</Reading>}
      {showExplanation && <ContrastBox point={point} />}
      <NoteBox point={point} />
      <MetaLine point={point} exerciseId={exerciseId} />
      <ActionBar>
        <Button size="lg" className="flex-1 md:flex-none md:min-w-40" onClick={onNext} kbd="↵" autoFocus>
          Další
        </Button>
      </ActionBar>
    </div>
  );
}
