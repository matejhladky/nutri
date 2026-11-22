"use client";
/**
 * Model client case: the client card stays on top, steps are worked through one at a time with immediate feedback
 * (a numeric step shows the correct value and working, which later steps then build on). The whole case is recorded
 * as ONE answer at the end, graded from the step outcomes (src/engine/evaluate.ts).
 */
import { useMemo, useState } from "react";
import type { CaseExercise, CaseStep } from "@/content/schema";
import { fmt, instantiateCase, rng, type CaseStepInstance } from "@/content/formulas";
import { evaluateCaseStep } from "@/engine/evaluate";
import type { CaseStepResponse, Evaluation, Outcome } from "@/engine/types";
import type { CaseStepDone } from "@/client/session";
import { Button, Kbd } from "../ui";
import { FeedbackFooter, useKeys, VerdictBadge } from "./shared";
import { useRecorder, type ExerciseProps } from "./parts";

type Done = CaseStepDone;

const dot: Record<Outcome, string> = {
  correct: "bg-sage-600",
  partial: "bg-amber-500",
  wrong: "bg-clay-600",
  unknown: "bg-line-strong",
};

export function CaseView(props: ExerciseProps & { exercise: CaseExercise }) {
  const { exercise, point, seed, onNext } = props;
  const { record } = useRecorder(props);
  const inst = useMemo(() => instantiateCase(exercise, seed), [exercise, seed]);
  // Finished steps survive a reload (persisted by StudyScreen via onCaseProgress); a finished case is restored.
  const [done, setDone] = useState<Done[]>(props.caseSteps ?? []);
  const [result, setResult] = useState<Evaluation | null>(props.restored?.evaluation ?? null);
  const idx = done.length;
  const total = exercise.steps.length;

  const finishStep = (d: Done) => {
    const next = [...done, d];
    setDone(next);
    // The final step is saved together with the recorded answer (one session write); earlier ones on their own.
    if (next.length < total) props.onCaseProgress?.(next);
    else setResult(record({ type: "case", seed, steps: next.map((x) => x.response) }, undefined, { caseSteps: next }));
  };

  return (
    <>
      <div className="rounded-2xl border border-line bg-paper px-4 py-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">Klient</div>
        <p className="text-[16px] leading-relaxed whitespace-pre-line">{inst.prompt}</p>
      </div>

      {done.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-label="Hotové kroky">
          {done.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-[15px]">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[d.outcome]}`} aria-hidden />
              <span className="text-muted">
                {i + 1}. {d.summary}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!result && idx < total && (
        <div className="flex flex-col gap-4" key={idx}>
          <div className="text-sm font-medium text-sage-700">
            Krok {idx + 1} z {total}
          </div>
          <StepView step={exercise.steps[idx]} inst={inst.steps[idx]} seed={seed + idx} onDone={finishStep} />
        </div>
      )}

      {result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={result.outcome !== "correct"}>
          <div className="flex flex-col gap-2">
            <VerdictBadge verdict={result.outcome} />
            <p className="text-[15px] text-muted">
              {result.outcome === "correct"
                ? "Celý případ bez chyby."
                : `Správně ${(result.stepOutcomes ?? []).filter((o) => o === "correct").length} z ${total} kroků. Příště dostaneš jiného klienta se stejným postupem.`}
            </p>
          </div>
        </FeedbackFooter>
      )}
    </>
  );
}

function StepView({ step, inst, seed, onDone }: { step: CaseStep; inst: CaseStepInstance; seed: number; onDone: (d: Done) => void }) {
  switch (step.type) {
    case "numeric":
      return <NumericStep step={step} inst={inst} onDone={onDone} />;
    case "choice":
      return <ChoiceStep step={step} inst={inst} seed={seed} onDone={onDone} />;
    case "explain":
      return <ExplainStep step={step} inst={inst} onDone={onDone} />;
    case "reveal":
      return <RevealStep step={step} inst={inst} onDone={onDone} />;
  }
}

function StepPrompt({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold leading-snug whitespace-pre-line">{children}</h2>;
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  useKeys({ Enter: onClick });
  return (
    <Button size="lg" onClick={onClick} kbd="↵" autoFocus>
      Pokračovat
    </Button>
  );
}

// ---------- numeric ----------

function NumericStep({ step, inst, onDone }: { step: Extract<CaseStep, { type: "numeric" }>; inst: CaseStepInstance; onDone: (d: Done) => void }) {
  const answer = inst.type === "numeric" ? inst.answer : 0;
  const working = inst.type === "numeric" ? inst.steps : [];
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(false);
  const [res, setRes] = useState<{ response: CaseStepResponse; outcome: Outcome } | null>(null);

  const check = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (res || !value.trim()) return;
    const response: CaseStepResponse = { type: "numeric", value, ...(hint ? { hint: true } : {}) };
    setRes({ response, outcome: evaluateCaseStep(step, inst, response) });
  };
  const correctLabel = `${fmt(answer, step.decimals)} ${step.unit}`;

  return (
    <>
      <StepPrompt>{inst.prompt}</StepPrompt>
      {!res ? (
        <form onSubmit={check} className="flex flex-col gap-3">
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
            <span className="shrink-0 text-muted">{step.unit}</span>
          </div>
          {step.hint &&
            (hint ? (
              <div className="rounded-2xl bg-sage-50 px-4 py-3 text-[15px] text-sage-700">💡 {step.hint}</div>
            ) : (
              <button type="button" onClick={() => setHint(true)} className="self-start text-sm text-sage-700 underline-offset-4 hover:underline">
                Nápověda
              </button>
            ))}
          <Button size="lg" type="submit" disabled={!value.trim()} kbd="↵">
            Zkontrolovat
          </Button>
          <Button variant="ghost" onClick={() => setRes({ response: { type: "dontKnow" }, outcome: "unknown" })}>
            Nevím, ukaž postup
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3 animate-rise">
          <VerdictBadge verdict={res.outcome} />
          <div className="text-[17px]">
            Výsledek: <strong className="tabular-nums">{correctLabel}</strong>
            {res.response.type === "numeric" && <span className="text-muted"> · tvoje odpověď {value}</span>}
          </div>
          <ol className="flex flex-col gap-1 rounded-2xl bg-paper px-4 py-3 text-[15px] tabular-nums">
            {working.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {res.outcome !== "correct" && <p className="text-sm text-muted">Dál počítáme se správnou hodnotou.</p>}
          <ContinueButton onClick={() => onDone({ ...res, summary: `${stripQuestion(inst.prompt)} → ${correctLabel}` })} />
        </div>
      )}
    </>
  );
}

// ---------- choice ----------

function ChoiceStep({
  step,
  inst,
  seed,
  onDone,
}: {
  step: Extract<CaseStep, { type: "choice" }>;
  inst: CaseStepInstance;
  seed: number;
  onDone: (d: Done) => void;
}) {
  const order = useMemo(() => {
    const idx = step.options.map((_, i) => i);
    const r = rng(seed);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [step.options, seed]);
  const [selected, setSelected] = useState<number[]>([]);
  const [guessed, setGuessed] = useState(false);
  const [res, setRes] = useState<{ response: CaseStepResponse; outcome: Outcome } | null>(null);

  const toggle = (orig: number) => {
    if (res) return;
    setSelected((s) => (step.multiple ? (s.includes(orig) ? s.filter((x) => x !== orig) : [...s, orig]) : [orig]));
  };
  const submit = () => {
    if (res || !selected.length) return;
    const response: CaseStepResponse = { type: "choice", selected, guessed };
    setRes({ response, outcome: evaluateCaseStep(step, inst, response) });
  };
  const keys: Record<string, () => void> = { Enter: submit };
  order.forEach((orig, i) => (keys[String(i + 1)] = () => toggle(orig)));
  useKeys(keys, !res);
  const correctText = step.options.filter((o) => o.correct).map((o) => o.text).join("; ");

  return (
    <>
      <StepPrompt>{inst.prompt}</StepPrompt>
      {step.multiple && !res && <p className="-mt-2 text-sm text-muted">Může být správně víc možností.</p>}
      <ul className="flex flex-col gap-2" role={step.multiple ? "group" : "radiogroup"}>
        {order.map((orig, i) => {
          const opt = step.options[orig];
          const isSel = selected.includes(orig);
          let cls = "border-line-strong bg-card hover:border-sage-500";
          if (!res && isSel) cls = "border-sage-600 bg-sage-50 ring-1 ring-sage-600";
          if (res) cls = opt.correct ? "border-sage-600 bg-sage-50" : isSel ? "border-clay-600 bg-clay-50" : "border-line bg-card opacity-70";
          return (
            <li key={orig}>
              <button
                type="button"
                role={step.multiple ? "checkbox" : "radio"}
                aria-checked={isSel}
                disabled={!!res}
                onClick={() => toggle(orig)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-[16px] leading-snug transition-colors ${cls}`}
              >
                <span className="flex-1">
                  {opt.text}
                  {res && opt.why && (isSel || opt.correct) && <span className="mt-1 block text-sm text-muted">{opt.why}</span>}
                </span>
                {!res && <Kbd>{i + 1}</Kbd>}
                {res && opt.correct && <span className="text-sm font-medium text-sage-700">správně</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!res ? (
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 self-start text-sm text-muted">
            <input type="checkbox" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} className="h-4 w-4 accent-sage-600" />
            Tipuji
          </label>
          <Button size="lg" onClick={submit} disabled={!selected.length} kbd="↵">
            Potvrdit
          </Button>
          <Button variant="ghost" onClick={() => setRes({ response: { type: "dontKnow" }, outcome: "unknown" })}>
            Nevím
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-rise">
          <VerdictBadge verdict={res.outcome} />
          {step.explanation && <p className="text-[15px]">{step.explanation}</p>}
          <ContinueButton onClick={() => onDone({ ...res, summary: `${stripQuestion(inst.prompt)} → ${correctText}` })} />
        </div>
      )}
    </>
  );
}

// ---------- explain ----------

function ExplainStep({ step, inst, onDone }: { step: Extract<CaseStep, { type: "explain" }>; inst: CaseStepInstance; onDone: (d: Done) => void }) {
  const [phase, setPhase] = useState<"answer" | "check">("answer");
  const [covered, setCovered] = useState<number[]>([]);
  useKeys({ Space: () => setPhase("check") }, phase === "answer");
  const finish = (response: CaseStepResponse) =>
    onDone({ response, outcome: evaluateCaseStep(step, inst, response), summary: `${stripQuestion(inst.prompt)} (ústně)` });
  const keys: Record<string, () => void> = { Enter: () => finish({ type: "explain", covered }) };
  step.keyPoints.forEach((_, i) => (keys[String(i + 1)] = () => setCovered((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))));
  useKeys(keys, phase === "check");

  return (
    <>
      <StepPrompt>{inst.prompt}</StepPrompt>
      {phase === "answer" ? (
        <>
          <p className="text-[15px] text-muted">Odpověz nahlas, jako bys mluvila s klientem nebo se zkoušejícím.</p>
          <Button size="lg" onClick={() => setPhase("check")} kbd="␣" autoFocus>
            Mám hotovo — porovnat
          </Button>
          <Button variant="ghost" onClick={() => setPhase("check")}>
            Nevím, ukaž vzor
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-4 animate-rise">
          <div>
            <p className="mb-2 font-medium">Co z toho jsi zmínila?</p>
            <ul className="flex flex-col gap-2">
              {step.keyPoints.map((kp, i) => {
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
            <p className="mt-2 leading-relaxed">{step.modelAnswer}</p>
          </details>
          <Button size="lg" onClick={() => finish({ type: "explain", covered })} kbd="↵">
            Pokračovat
          </Button>
        </div>
      )}
    </>
  );
}

// ---------- reveal ----------

function RevealStep({ step, inst, onDone }: { step: Extract<CaseStep, { type: "reveal" }>; inst: CaseStepInstance; onDone: (d: Done) => void }) {
  const [shown, setShown] = useState(false);
  const grade = (selfGrade: "again" | "hard" | "good") => {
    const response: CaseStepResponse = { type: "reveal", selfGrade };
    onDone({ response, outcome: evaluateCaseStep(step, inst, response), summary: `${stripQuestion(inst.prompt)} → ${step.answer}` });
  };
  useKeys({ Space: () => setShown(true), Enter: () => setShown(true) }, !shown);
  useKeys({ "1": () => grade("again"), "2": () => grade("hard"), "3": () => grade("good") }, shown);
  return (
    <>
      <StepPrompt>{inst.prompt}</StepPrompt>
      {!shown ? (
        <Button size="lg" onClick={() => setShown(true)} kbd="␣" autoFocus>
          Ukázat odpověď
        </Button>
      ) : (
        <div className="flex flex-col gap-3 animate-rise">
          <div className="rounded-2xl border border-sage-100 bg-sage-50/60 px-4 py-3 text-[17px] leading-relaxed">{step.answer}</div>
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
        </div>
      )}
    </>
  );
}

/** Short label for the done-steps list: the prompt's last sentence (the actual question), without "?" or ":". */
function stripQuestion(prompt: string): string {
  const first = prompt.split(/(?<=[.?!])\s/).filter((s) => s.trim()).pop() ?? prompt;
  return first.replace(/[?:]\s*$/, "").slice(0, 90);
}

