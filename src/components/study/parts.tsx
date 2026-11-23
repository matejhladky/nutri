"use client";
/** Building blocks shared by the exercise views (ExerciseCard, CaseView). */
import { useMemo, useRef, useState } from "react";
import { rng } from "@/content/formulas";
import { Icon, Kbd } from "../ui";
import type { Exercise, PointWithTopic } from "@/content/schema";
import { evaluate } from "@/engine/evaluate";
import type { Evaluation, Response } from "@/engine/types";
import type { AnsweredCard, CaseStepDone } from "@/client/session";

export type AnswerRecord = {
  exerciseId: string;
  exerciseVersion: number;
  evaluation: Evaluation;
  response: Response;
  hintUsed: boolean;
  durationMs: number;
  /** Client case: all finished steps, saved together with the answer. */
  caseSteps?: CaseStepDone[];
};

export type ExerciseProps = {
  point: PointWithTopic;
  exercise: Exercise;
  seed: number;
  reason: string;
  onRecord: (a: AnswerRecord) => void;
  onNext: () => void;
  /** Already answered (restored after a reload): show the feedback, never record again. */
  restored?: AnsweredCard;
  /** Client case: steps finished before a reload, and a callback to persist each finished step. */
  caseSteps?: CaseStepDone[];
  onCaseProgress?: (steps: CaseStepDone[]) => void;
};

export function useRecorder(props: ExerciseProps) {
  const [started] = useState(() => Date.now());
  const [hintUsed, setHintUsed] = useState(props.restored?.hintUsed ?? false);
  /** One answer per card: a double tap or a restored card can never grade twice. */
  const recorded = useRef(!!props.restored);
  const record = (response: Response, evaluation?: Evaluation, extra?: Pick<AnswerRecord, "caseSteps">) => {
    const ev = evaluation ?? evaluate(props.exercise, response, { hintUsed });
    if (recorded.current) return ev;
    recorded.current = true;
    props.onRecord({
      exerciseId: props.exercise.id,
      exerciseVersion: props.exercise.version,
      evaluation: ev,
      response,
      hintUsed,
      durationMs: Math.min(Date.now() - started, 3_600_000),
      ...extra,
    });
    return ev;
  };
  return { record, hintUsed, setHintUsed };
}

export function Prompt({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-[22px] font-medium leading-[1.38] whitespace-pre-line text-ink md:text-[27px] md:leading-[1.32]">{children}</h2>;
}

export function HintButton({ hint, shown, onShow }: { hint?: string; shown: boolean; onShow: () => void }) {
  if (!hint) return null;
  if (shown) return <div className="rounded-2xl bg-sage-50 px-4 py-3 text-[15px] leading-relaxed text-sage-700 animate-rise">{hint}</div>;
  return (
    <button type="button" onClick={onShow} className="self-start text-[15px] font-medium text-sage-600 underline-offset-4 hover:underline">
      Nápověda
    </button>
  );
}

/** Deterministic option order for a card (shuffled by its seed, so a reload shows the same order). */
export function useShuffled(count: number, seed: number) {
  return useMemo(() => {
    const idx = Array.from({ length: count }, (_, i) => i);
    const r = rng(seed);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [count, seed]);
}

type Option = { text: string; correct: boolean; why?: string };

/**
 * Answer options as calm rows. Before checking: a numbered marker (numbers = keyboard shortcuts on desktop).
 * After: the correct option(s) get a check, a wrong pick a cross, the rest fade; "why" texts appear under the
 * picked and the correct options.
 */
export function OptionList({
  options,
  order,
  selected,
  multiple,
  revealed,
  onToggle,
}: {
  options: Option[];
  order: number[];
  selected: number[];
  multiple: boolean;
  revealed: boolean;
  onToggle: (orig: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-2.5" role={multiple ? "group" : "radiogroup"} aria-label="Možnosti">
      {order.map((orig, i) => {
        const opt = options[orig];
        const isSel = selected.includes(orig);
        const state = !revealed ? (isSel ? "selected" : "idle") : opt.correct ? "correct" : isSel ? "wrong" : "dim";
        const box = {
          idle: "border-line bg-card hover:border-line-strong",
          selected: "border-sage-600 bg-sage-50",
          correct: "border-sage-600 bg-sage-50",
          wrong: "border-clay-600 bg-clay-50",
          dim: "border-line/70 text-faint",
        }[state];
        const marker = {
          idle: "border-[1.5px] border-line-strong text-faint",
          selected: "bg-sage-600 text-white",
          correct: "bg-sage-600 text-white",
          wrong: "bg-clay-600 text-white",
          dim: "",
        }[state];
        const why = revealed && opt.why && (isSel || opt.correct) ? opt.why : null;
        return (
          <li key={orig}>
            <button
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={isSel}
              disabled={revealed}
              onClick={() => onToggle(orig)}
              className={`flex w-full items-start gap-3.5 rounded-[14px] border px-4 py-3.5 text-left text-[16.5px] leading-snug transition-colors ${box}`}
            >
              <span aria-hidden className={`mt-[-1px] flex h-[26px] w-[26px] shrink-0 items-center justify-center text-[13px] ${multiple ? "rounded-[8px]" : "rounded-full"} ${marker}`}>
                {state === "correct" || (state === "selected" && multiple) ? (
                  <Icon name="check" size={14} />
                ) : state === "wrong" ? (
                  <Icon name="close" size={14} />
                ) : state === "dim" ? null : (
                  <span className={state === "selected" ? "" : "hidden md:inline"}>{i + 1}</span>
                )}
              </span>
              <span className="flex-1">
                {opt.text}
                {revealed && opt.correct && <span className="sr-only"> (správná odpověď)</span>}
                {why && <span className={`mt-1.5 block text-[14.5px] leading-snug ${state === "wrong" ? "text-[#6e3540]" : "text-muted"}`}>{why}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Tipuji" — a correct guess counts as uncertain. */
export function GuessToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 self-start text-[15px] text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] accent-sage-600" />
      Tipuji
    </label>
  );
}

export function NumberInput({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <div className="flex items-center gap-3">
      <input
        inputMode="decimal"
        autoFocus
        autoComplete="off"
        aria-label="Výsledek"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-14 w-full max-w-xs rounded-[14px] border border-line-strong bg-card px-4 text-xl tabular-nums outline-none focus:border-sage-600"
        placeholder="Výsledek"
      />
      {unit && <span className="shrink-0 text-lg text-muted">{unit}</span>}
    </div>
  );
}

/** Correct result + worked solution. */
export function Worked({ answer, mine, steps }: { answer: string; mine: string | null; steps: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[17px]">
        Výsledek <strong className="font-semibold tabular-nums">{answer}</strong>
        {mine && <span className="text-muted">, tvoje odpověď {mine}</span>}
      </p>
      <ol className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 py-3.5 text-[15px] leading-snug tabular-nums ring-1 ring-line">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

/** Key points to tick after answering aloud (shared with case steps). */
export function KeyPointChecklist({ keyPoints, covered, onToggle }: { keyPoints: string[]; covered: number[]; onToggle: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">Co z toho jsi zmínila?</p>
      <ul className="flex flex-col gap-2">
        {keyPoints.map((kp, i) => {
          const on = covered.includes(i);
          return (
            <li key={i}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggle(i)}
                className={`flex w-full items-start gap-3.5 rounded-[14px] border px-4 py-3 text-left text-[15.5px] leading-snug transition-colors ${on ? "border-sage-600 bg-sage-50" : "border-line bg-card hover:border-line-strong"}`}
              >
                <span aria-hidden className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] ${on ? "bg-sage-600 text-white" : "border-[1.5px] border-line-strong"}`}>
                  {on && <Icon name="check" size={13} />}
                </span>
                <span className="flex-1">{kp}</span>
                <Kbd>{i + 1}</Kbd>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
