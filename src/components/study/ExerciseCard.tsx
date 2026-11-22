"use client";
import { useMemo, useState } from "react";
import type { ChoiceExercise, ExplainExercise, NumericExercise, RevealExercise } from "@/content/schema";
import { fmt, instantiate, rng } from "@/content/formulas";
import { evaluate } from "@/engine/evaluate";
import type { Evaluation } from "@/engine/types";
import { topicsById } from "@/lib/content";
import { Button, Eyebrow, Kbd } from "../ui";
import { FeedbackFooter, ReportLink, useKeys, VerdictBadge } from "./shared";
import { HintButton, Prompt, useRecorder, type ExerciseProps as Props } from "./parts";
import { CaseView } from "./CaseView";

export type { AnswerRecord } from "./parts";

export function ExerciseCard(props: Props) {
  const { point, exercise, reason } = props;
  const label =
    exercise.type === "case" ? "Modelový případ" : reason === "review" ? "Opakování" : reason === "practice" ? "Procvičení" : "Ověření";
  return (
    <div className="flex flex-col gap-5 animate-rise" key={`${point.id}/${exercise.id}/${props.seed}`}>
      <Eyebrow>
        {exercise.type === "case" ? `${label} · ${point.title}` : `${label} · ${topicsById.get(point.topicId)?.title}`}
      </Eyebrow>
      {exercise.type === "reveal" && <RevealView {...props} exercise={exercise} />}
      {exercise.type === "choice" && <ChoiceView {...props} exercise={exercise} />}
      {exercise.type === "numeric" && <NumericView {...props} exercise={exercise} />}
      {exercise.type === "explain" && <ExplainView {...props} exercise={exercise} />}
      {exercise.type === "case" && <CaseView {...props} exercise={exercise} />}
    </div>
  );
}

// ---------- reveal ----------

function RevealView(props: Props & { exercise: RevealExercise }) {
  const { exercise, point, onNext } = props;
  const { record, hintUsed, setHintUsed } = useRecorder(props);
  const [phase, setPhase] = useState<"think" | "revealed" | "dontKnow">("think");

  const grade = (selfGrade: "again" | "hard" | "good") => {
    record({ type: "reveal", selfGrade });
    onNext();
  };
  const dontKnow = () => {
    record({ type: "dontKnow" });
    setPhase("dontKnow");
  };
  useKeys({ Space: () => setPhase("revealed"), Enter: () => setPhase("revealed") }, phase === "think");
  useKeys({ "1": () => grade("again"), "2": () => grade("hard"), "3": () => grade("good") }, phase === "revealed");

  return (
    <>
      <Prompt>{exercise.prompt}</Prompt>
      {phase === "think" && (
        <>
          <p className="text-[15px] text-muted">Zkus si odpověď vybavit — v duchu nebo nahlas. Pak si ji zkontroluj.</p>
          <HintButton hint={exercise.hint} shown={hintUsed} onShow={() => setHintUsed(true)} />
          <div className="mt-2 flex flex-col gap-2">
            <Button size="lg" onClick={() => setPhase("revealed")} kbd="␣" autoFocus>
              Ukázat odpověď
            </Button>
            <Button variant="ghost" onClick={dontKnow}>
              Nevím
            </Button>
          </div>
        </>
      )}
      {phase !== "think" && (
        <div className="rounded-2xl border border-sage-100 bg-sage-50/60 px-4 py-3 text-[17px] leading-relaxed animate-rise">{exercise.answer}</div>
      )}
      {phase === "revealed" && (
        <div className="flex flex-col gap-3 animate-rise">
          <p className="text-center text-sm text-muted">Jak to šlo?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" className="!px-2 text-clay-600" onClick={() => grade("again")} kbd="1">
              Nevěděla
            </Button>
            <Button variant="secondary" className="!px-2 text-amber-600" onClick={() => grade("hard")} kbd="2">
              S námahou
            </Button>
            <Button variant="secondary" className="!px-2 text-sage-700" onClick={() => grade("good")} kbd="3">
              Věděla
            </Button>
          </div>
          <div className="flex justify-end">
            <ReportLink pointId={point.id} exerciseId={exercise.id} />
          </div>
        </div>
      )}
      {phase === "dontKnow" && <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} />}
    </>
  );
}

// ---------- choice ----------

function ChoiceView(props: Props & { exercise: ChoiceExercise }) {
  const { exercise, point, seed, onNext } = props;
  const { record, hintUsed, setHintUsed } = useRecorder(props);
  /** Display order (indices into exercise.options), shuffled deterministically by seed. */
  const order = useMemo(() => {
    const idx = exercise.options.map((_, i) => i);
    const r = rng(seed);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [exercise.options, seed]);
  const [selected, setSelected] = useState<number[]>([]);
  const [guessed, setGuessed] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);

  const toggle = (orig: number) => {
    if (result) return;
    setSelected((s) => (exercise.multiple ? (s.includes(orig) ? s.filter((x) => x !== orig) : [...s, orig]) : [orig]));
  };
  const submit = () => {
    if (result || !selected.length) return;
    setResult(record({ type: "choice", selected, guessed }));
  };
  const dontKnow = () => {
    if (result) return;
    setResult(record({ type: "dontKnow" }));
  };
  const keys: Record<string, () => void> = { Enter: submit };
  order.forEach((orig, i) => (keys[String(i + 1)] = () => toggle(orig)));
  useKeys(keys, !result);

  return (
    <>
      <Prompt>{exercise.prompt}</Prompt>
      {exercise.multiple && !result && <p className="-mt-2 text-sm text-muted">Může být správně víc možností.</p>}
      <ul className="flex flex-col gap-2" role={exercise.multiple ? "group" : "radiogroup"}>
        {order.map((orig, i) => {
          const opt = exercise.options[orig];
          const isSel = selected.includes(orig);
          let cls = "border-line-strong bg-card hover:border-sage-500";
          if (!result && isSel) cls = "border-sage-600 bg-sage-50 ring-1 ring-sage-600";
          if (result) {
            if (opt.correct) cls = "border-sage-600 bg-sage-50";
            else if (isSel) cls = "border-clay-600 bg-clay-50";
            else cls = "border-line bg-card opacity-70";
          }
          const showWhy = result && opt.why && (isSel || opt.correct);
          return (
            <li key={orig}>
              <button
                type="button"
                role={exercise.multiple ? "checkbox" : "radio"}
                aria-checked={isSel}
                disabled={!!result}
                onClick={() => toggle(orig)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-[16px] leading-snug transition-colors ${cls}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${exercise.multiple ? "rounded-md" : "rounded-full"} border ${
                    !isSel ? "border-line-strong" : result && !opt.correct ? "border-clay-600 bg-clay-600 text-white" : "border-sage-600 bg-sage-600 text-white"
                  }`}
                  aria-hidden
                >
                  {isSel && <span className="text-[11px]">{result && !opt.correct ? "✕" : "✓"}</span>}
                </span>
                <span className="flex-1">
                  {opt.text}
                  {showWhy && <span className="mt-1 block text-sm text-muted">{opt.why}</span>}
                </span>
                {!result && <Kbd>{i + 1}</Kbd>}
                {result && opt.correct && <span className="text-sm font-medium text-sage-700">správně</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!result && (
        <>
          <HintButton hint={exercise.hint} shown={hintUsed} onShow={() => setHintUsed(true)} />
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 self-start text-sm text-muted">
              <input type="checkbox" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} className="h-4 w-4 accent-sage-600" />
              Tipuji
            </label>
            <Button size="lg" onClick={submit} disabled={!selected.length} kbd="↵">
              Potvrdit
            </Button>
            <Button variant="ghost" onClick={dontKnow}>
              Nevím
            </Button>
          </div>
        </>
      )}
      {result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={result.outcome !== "correct"}>
          <div className="flex flex-col gap-2">
            <VerdictBadge verdict={result.outcome} />
            {result.outcome === "correct" && guessed && <p className="text-sm text-muted">Tip vyšel — příště to zkusíme znovu, ať je to jisté.</p>}
            {exercise.explanation && <p className="text-[15px]">{exercise.explanation}</p>}
          </div>
        </FeedbackFooter>
      )}
    </>
  );
}

// ---------- numeric ----------

function NumericView(props: Props & { exercise: NumericExercise }) {
  const { exercise, point, seed, onNext } = props;
  const { record, hintUsed, setHintUsed } = useRecorder(props);
  const inst = useMemo(() => instantiate(exercise, seed), [exercise, seed]);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Evaluation | null>(null);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (result || !value.trim()) return;
    setResult(record({ type: "numeric", value, seed }));
  };
  const dontKnow = () => {
    if (result) return;
    const ev = evaluate(exercise, { type: "dontKnow" });
    record({ type: "dontKnow" }, ev);
    setResult({ ...ev, expected: inst.answer, steps: inst.steps });
  };

  return (
    <>
      <Prompt>{inst.prompt}</Prompt>
      {!result && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              inputMode="decimal"
              autoFocus
              autoComplete="off"
              aria-label="Výsledek"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-h-14 w-full rounded-2xl border border-line-strong bg-card px-4 text-xl tabular-nums outline-none focus:border-sage-500"
              placeholder="Výsledek"
            />
            {exercise.unit && <span className="shrink-0 text-muted">{exercise.unit}</span>}
          </div>
          <p className="text-xs text-faint">Klidně si to spočítej na papíře nebo v kalkulačce.</p>
          <HintButton hint={exercise.hint} shown={hintUsed} onShow={() => setHintUsed(true)} />
          <Button size="lg" type="submit" disabled={!value.trim()} kbd="↵">
            Zkontrolovat
          </Button>
          <Button variant="ghost" onClick={dontKnow}>
            Nevím, ukaž postup
          </Button>
        </form>
      )}
      {result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={result.outcome !== "correct"}>
          <div className="flex flex-col gap-3">
            <VerdictBadge verdict={result.outcome} />
            <div className="text-[17px]">
              Výsledek: <strong className="tabular-nums">{fmt(result.expected ?? inst.answer, exercise.decimals)}</strong> {exercise.unit}
              {result.outcome !== "unknown" && (
                <span className="text-muted"> · tvoje odpověď {value}</span>
              )}
            </div>
            <ol className="flex flex-col gap-1 rounded-2xl bg-paper px-4 py-3 text-[15px] tabular-nums">
              {(result.steps ?? inst.steps).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </FeedbackFooter>
      )}
    </>
  );
}

// ---------- explain ----------

function ExplainView(props: Props & { exercise: ExplainExercise }) {
  const { exercise, point, onNext } = props;
  const { record } = useRecorder(props);
  const [phase, setPhase] = useState<"answer" | "check" | "dontKnow">("answer");
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [covered, setCovered] = useState<number[]>([]);

  const finish = () => {
    record({ type: "explain", covered, text: text.trim() || undefined });
    onNext();
  };
  const dontKnow = () => {
    record({ type: "dontKnow" });
    setPhase("dontKnow");
  };
  useKeys({ Space: () => setPhase("check") }, phase === "answer" && !writing);
  const keys: Record<string, () => void> = { Enter: finish };
  exercise.keyPoints.forEach((_, i) => (keys[String(i + 1)] = () => setCovered((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))));
  useKeys(keys, phase === "check");

  return (
    <>
      <Prompt>{exercise.prompt}</Prompt>
      {phase === "answer" && (
        <>
          <p className="text-[15px] text-muted">Odpověz vlastními slovy — nejlépe nahlas, jako u ústní zkoušky.</p>
          {writing ? (
            <textarea
              rows={5}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-2xl border border-line-strong bg-card px-4 py-3 text-[16px] outline-none focus:border-sage-500"
              placeholder="Tvoje odpověď…"
            />
          ) : (
            <button type="button" onClick={() => setWriting(true)} className="self-start text-sm text-sage-700 underline-offset-4 hover:underline">
              Raději napíšu
            </button>
          )}
          <div className="mt-1 flex flex-col gap-2">
            <Button size="lg" onClick={() => setPhase("check")} kbd={writing ? undefined : "␣"} autoFocus={!writing}>
              Mám hotovo — porovnat
            </Button>
            <Button variant="ghost" onClick={dontKnow}>
              Nevím
            </Button>
          </div>
        </>
      )}
      {phase === "check" && (
        <div className="flex flex-col gap-4 animate-rise">
          {text.trim() && <div className="rounded-2xl border border-line px-4 py-3 text-[15px] text-muted whitespace-pre-line">{text}</div>}
          <div>
            <p className="mb-2 font-medium">Co z toho jsi zmínila?</p>
            <ul className="flex flex-col gap-2">
              {exercise.keyPoints.map((kp, i) => {
                const on = covered.includes(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setCovered((c) => (on ? c.filter((x) => x !== i) : [...c, i]))}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] leading-snug ${on ? "border-sage-600 bg-sage-50" : "border-line-strong bg-card"}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-sage-600 bg-sage-600 text-white" : "border-line-strong"}`} aria-hidden>
                        {on && <span className="text-[11px]">✓</span>}
                      </span>
                      <span className="flex-1">{kp}</span>
                      <Kbd>{i + 1}</Kbd>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <details className="rounded-2xl bg-paper px-4 py-3 text-[15px]">
            <summary className="cursor-pointer font-medium text-muted">Vzorová odpověď</summary>
            <p className="mt-2 leading-relaxed">{exercise.modelAnswer}</p>
          </details>
          <div className="flex justify-end">
            <ReportLink pointId={point.id} exerciseId={exercise.id} />
          </div>
          <Button size="lg" onClick={finish} kbd="↵">
            Hotovo
          </Button>
        </div>
      )}
      {phase === "dontKnow" && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext}>
          <div className="flex flex-col gap-3">
            <VerdictBadge verdict="unknown" />
            <p className="text-[16px] leading-relaxed">{exercise.modelAnswer}</p>
            <ul className="list-disc pl-5 text-[15px] text-muted">
              {exercise.keyPoints.map((kp, i) => (
                <li key={i}>{kp}</li>
              ))}
            </ul>
          </div>
        </FeedbackFooter>
      )}
    </>
  );
}
