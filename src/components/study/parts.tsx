"use client";
/** Building blocks shared by the exercise views (ExerciseCard, CaseView). */
import { useState } from "react";
import type { Exercise, PointWithTopic } from "@/content/schema";
import { evaluate } from "@/engine/evaluate";
import type { Evaluation, Response } from "@/engine/types";

export type AnswerRecord = {
  exerciseId: string;
  exerciseVersion: number;
  evaluation: Evaluation;
  response: Response;
  hintUsed: boolean;
  durationMs: number;
};

export type ExerciseProps = {
  point: PointWithTopic;
  exercise: Exercise;
  seed: number;
  reason: string;
  onRecord: (a: AnswerRecord) => void;
  onNext: () => void;
};

export function useRecorder(props: ExerciseProps) {
  const [started] = useState(() => Date.now());
  const [hintUsed, setHintUsed] = useState(false);
  const record = (response: Response, evaluation?: Evaluation) => {
    const ev = evaluation ?? evaluate(props.exercise, response, { hintUsed });
    props.onRecord({
      exerciseId: props.exercise.id,
      exerciseVersion: props.exercise.version,
      evaluation: ev,
      response,
      hintUsed,
      durationMs: Math.min(Date.now() - started, 3_600_000),
    });
    return ev;
  };
  return { record, hintUsed, setHintUsed };
}

export function Prompt({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold leading-snug whitespace-pre-line">{children}</h2>;
}

export function HintButton({ hint, shown, onShow }: { hint?: string; shown: boolean; onShow: () => void }) {
  if (!hint) return null;
  if (shown) return <div className="rounded-2xl bg-sage-50 px-4 py-3 text-[15px] text-sage-700">💡 {hint}</div>;
  return (
    <button type="button" onClick={onShow} className="self-start text-sm text-sage-700 underline-offset-4 hover:underline">
      Nápověda
    </button>
  );
}

