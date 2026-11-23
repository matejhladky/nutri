"use client";
/**
 * Model client case: the client card stays on top, steps are worked through one at a time with immediate feedback
 * (a numeric step shows the correct value and working, which later steps then build on). The whole case is recorded
 * as ONE answer at the end, graded from the step outcomes (src/engine/evaluate.ts).
 */
import { useMemo, useState } from "react";
import type { CaseExercise, CaseStep } from "@/content/schema";
import { fmt, instantiateCase, type CaseStepInstance } from "@/content/formulas";
import { evaluateCaseStep } from "@/engine/evaluate";
import type { CaseStepResponse, Evaluation, Outcome } from "@/engine/types";
import type { CaseStepDone } from "@/client/session";
import { ActionBar, Button } from "../ui";
import { FeedbackFooter, Reading, useKeys, VerdictBadge } from "./shared";
import { GuessToggle, KeyPointChecklist, NumberInput, OptionList, useRecorder, useShuffled, Worked, type ExerciseProps } from "./parts";

type Done = CaseStepDone;

const marker: Record<Outcome, string> = {
  correct: "bg-sage-600 text-white",
  partial: "bg-amber-600 text-white",
  wrong: "bg-clay-600 text-white",
  unknown: "bg-line-strong text-white",
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
      <div className="rounded-2xl bg-card px-5 py-4 ring-1 ring-line">
        <p className="mb-1 text-[13.5px] font-semibold text-muted">Klient</p>
        <Reading className="!text-[16.5px] whitespace-pre-line">{inst.prompt}</Reading>
      </div>

      {done.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Hotové kroky">
          {done.map((d, i) => (
            <li key={i} className="flex items-start gap-3 text-[15px] leading-snug text-muted">
              <span aria-hidden className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${marker[d.outcome]}`}>
                {i + 1}
              </span>
              <span>{d.summary}</span>
            </li>
          ))}
        </ol>
      )}

      {!result && idx < total && (
        <div className="flex flex-col gap-5" key={idx}>
          <div className="flex items-center gap-3">
            <p className="text-[14px] font-semibold text-sage-600">
              Krok {idx + 1} z {total}
            </p>
            <span aria-hidden className="flex flex-1 gap-1">
              {exercise.steps.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i < idx ? "bg-sage-600" : i === idx ? "bg-sage-200" : "bg-line"}`} />
              ))}
            </span>
          </div>
          <StepView step={exercise.steps[idx]} inst={inst.steps[idx]} seed={seed + idx} onDone={finishStep} />
        </div>
      )}

      {result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={result.outcome !== "correct"}>
          <VerdictBadge verdict={result.outcome}>
            {result.outcome === "correct"
              ? "celý případ bez chyby"
              : `správně ${(result.stepOutcomes ?? []).filter((o) => o === "correct").length} z ${total} kroků`}
          </VerdictBadge>
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
  return <h2 className="font-serif text-[20px] font-medium leading-[1.4] whitespace-pre-line md:text-[22px]">{children}</h2>;
}

function ContinueBar({ onClick }: { onClick: () => void }) {
  useKeys({ Enter: onClick });
  return (
    <ActionBar>
      <Button size="lg" className="flex-1 md:flex-none md:min-w-40" onClick={onClick} kbd="↵" autoFocus>
        Pokračovat
      </Button>
    </ActionBar>
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
        <form onSubmit={check} className="flex flex-col gap-4">
          <NumberInput value={value} onChange={setValue} unit={step.unit} />
          {step.hint &&
            (hint ? (
              <div className="rounded-2xl bg-sage-50 px-4 py-3 text-[15px] leading-relaxed text-sage-700">{step.hint}</div>
            ) : (
              <button type="button" onClick={() => setHint(true)} className="self-start text-[15px] font-medium text-sage-600 underline-offset-4 hover:underline">
                Nápověda
              </button>
            ))}
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={() => setRes({ response: { type: "dontKnow" }, outcome: "unknown" })}>
              Nevím, ukaž postup
            </Button>
            <Button size="lg" type="submit" className="flex-1 md:flex-none md:min-w-40" disabled={!value.trim()} kbd="↵">
              Zkontrolovat
            </Button>
          </ActionBar>
        </form>
      ) : (
        <div className="flex flex-col gap-4 border-t border-line pt-5 animate-rise">
          <VerdictBadge verdict={res.outcome}>{res.outcome !== "correct" ? "dál počítáme se správnou hodnotou" : null}</VerdictBadge>
          <Worked answer={correctLabel} mine={res.response.type === "numeric" ? value : null} steps={working} />
          <ContinueBar onClick={() => onDone({ ...res, summary: `${stripQuestion(inst.prompt)} → ${correctLabel}` })} />
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
  const order = useShuffled(step.options.length, seed);
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
      <div className="flex flex-col gap-2">
        <StepPrompt>{inst.prompt}</StepPrompt>
        {step.multiple && !res && <p className="text-[15px] text-muted">Vyber všechny správné.</p>}
      </div>
      <OptionList options={step.options} order={order} selected={selected} multiple={step.multiple} revealed={!!res} onToggle={toggle} />
      {!res ? (
        <>
          <GuessToggle checked={guessed} onChange={setGuessed} />
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={() => setRes({ response: { type: "dontKnow" }, outcome: "unknown" })}>
              Nevím
            </Button>
            <Button size="lg" className="flex-1 md:flex-none md:min-w-40" onClick={submit} disabled={!selected.length} kbd="↵">
              Potvrdit
            </Button>
          </ActionBar>
        </>
      ) : (
        <div className="flex flex-col gap-3 animate-rise">
          <VerdictBadge verdict={res.outcome} />
          {step.explanation && <p className="text-[15.5px] text-muted">{step.explanation}</p>}
          <ContinueBar onClick={() => onDone({ ...res, summary: `${stripQuestion(inst.prompt)} → ${correctText}` })} />
        </div>
      )}
    </>
  );
}

// ---------- explain ----------

function ExplainStep({ step, inst, onDone }: { step: Extract<CaseStep, { type: "explain" }>; inst: CaseStepInstance; onDone: (d: Done) => void }) {
  const [phase, setPhase] = useState<"answer" | "check">("answer");
  const [covered, setCovered] = useState<number[]>([]);
  const toggle = (i: number) => setCovered((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
  useKeys({ Space: () => setPhase("check") }, phase === "answer");
  const finish = (response: CaseStepResponse) =>
    onDone({ response, outcome: evaluateCaseStep(step, inst, response), summary: `${stripQuestion(inst.prompt)} (ústně)` });
  const keys: Record<string, () => void> = { Enter: () => finish({ type: "explain", covered }) };
  step.keyPoints.forEach((_, i) => (keys[String(i + 1)] = () => toggle(i)));
  useKeys(keys, phase === "check");

  return (
    <>
      <StepPrompt>{inst.prompt}</StepPrompt>
      {phase === "answer" ? (
        <>
          <p className="text-[15.5px] text-muted">Odpověz nahlas, jako bys mluvila s klientem.</p>
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={() => setPhase("check")}>
              Nevím, ukaž vzor
            </Button>
            <Button size="lg" className="flex-1 md:flex-none" onClick={() => setPhase("check")} kbd="␣" autoFocus>
              Mám hotovo — porovnat
            </Button>
          </ActionBar>
        </>
      ) : (
        <div className="flex flex-col gap-5 animate-rise">
          <KeyPointChecklist keyPoints={step.keyPoints} covered={covered} onToggle={toggle} />
          <details className="group">
            <summary className="cursor-pointer list-none font-medium text-sage-600">
              <span className="group-open:hidden">Ukázat vzorovou odpověď</span>
              <span className="hidden group-open:inline">Vzorová odpověď</span>
            </summary>
            <Reading className="mt-2">{step.modelAnswer}</Reading>
          </details>
          <ActionBar>
            <Button size="lg" className="flex-1 md:flex-none md:min-w-40" onClick={() => finish({ type: "explain", covered })} kbd="↵">
              Pokračovat
            </Button>
          </ActionBar>
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
        <ActionBar>
          <Button size="lg" className="flex-1 md:flex-none md:min-w-48" onClick={() => setShown(true)} kbd="␣" autoFocus>
            Ukázat odpověď
          </Button>
        </ActionBar>
      ) : (
        <div className="flex flex-col gap-4 animate-rise">
          <Reading className="rounded-2xl bg-sage-50 px-5 py-4 text-ink">{step.answer}</Reading>
          <p className="-mb-3 font-medium text-muted md:mb-0 md:text-right">Jak to šlo?</p>
          <ActionBar className="md:!mt-0">
            <Button variant="secondary" className="flex-1 !px-2 text-clay-600 md:flex-none md:!px-5" onClick={() => grade("again")} kbd="1">
              Nevěděla
            </Button>
            <Button variant="secondary" className="flex-1 !px-2 text-amber-700 md:flex-none md:!px-5" onClick={() => grade("hard")} kbd="2">
              S námahou
            </Button>
            <Button variant="secondary" className="flex-1 !px-2 text-sage-600 md:flex-none md:!px-5" onClick={() => grade("good")} kbd="3">
              Věděla
            </Button>
          </ActionBar>
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
