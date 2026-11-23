"use client";
import { useMemo, useState } from "react";
import type { ChoiceExercise, ExplainExercise, NumericExercise, RevealExercise } from "@/content/schema";
import { fmt, instantiate } from "@/content/formulas";
import { evaluate } from "@/engine/evaluate";
import type { Evaluation } from "@/engine/types";
import { topicsById } from "@/lib/content";
import { plural } from "@/lib/format";
import { ActionBar, Button, CardMeta } from "../ui";
import { FeedbackFooter, MetaLine, Reading, useKeys, VerdictBadge } from "./shared";
import { GuessToggle, HintButton, KeyPointResult, KeyPointReview, NumberInput, OptionList, Prompt, useRecorder, useShuffled, Worked, type ExerciseProps as Props } from "./parts";
import { CaseView } from "./CaseView";

export type { AnswerRecord } from "./parts";

export function ExerciseCard(props: Props) {
  const { point, exercise, reason } = props;
  const isCase = exercise.type === "case";
  const badge = isCase ? "Modelový případ" : reason === "new" ? "Nové" : reason === "practice" ? "Procvičení" : undefined;
  return (
    <div className="flex flex-col gap-6 animate-rise" key={`${point.id}/${exercise.id}/${props.seed}`}>
      <CardMeta badge={badge}>{isCase ? point.title : topicsById.get(point.topicId)?.title}</CardMeta>
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
  const [phase, setPhase] = useState<"think" | "revealed" | "dontKnow" | "done">(() =>
    !props.restored ? "think" : props.restored.response.type === "dontKnow" ? "dontKnow" : "done",
  );

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
          <HintButton hint={exercise.hint} shown={hintUsed} onShow={() => setHintUsed(true)} />
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={dontKnow}>
              Nevím
            </Button>
            <Button size="lg" className="flex-1 md:flex-none md:min-w-48" onClick={() => setPhase("revealed")} kbd="␣" autoFocus>
              Ukázat odpověď
            </Button>
          </ActionBar>
        </>
      )}
      {phase !== "think" && <Reading className="rounded-2xl bg-sage-50 px-5 py-4 text-ink animate-rise">{exercise.answer}</Reading>}
      {phase === "revealed" && props.reason === "new" && <Reading>{point.explanation}</Reading>}
      {phase === "revealed" && (
        <>
          <MetaLine point={point} exerciseId={exercise.id} />
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
        </>
      )}
      {(phase === "dontKnow" || phase === "done") && <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} />}
    </>
  );
}

// ---------- choice ----------

function ChoiceView(props: Props & { exercise: ChoiceExercise }) {
  const { exercise, point, seed, onNext } = props;
  const { record, hintUsed, setHintUsed } = useRecorder(props);
  const order = useShuffled(exercise.options.length, seed);
  const prev = props.restored?.response.type === "choice" ? props.restored.response : null;
  const [selected, setSelected] = useState<number[]>(prev?.selected ?? []);
  const [guessed, setGuessed] = useState(prev?.guessed ?? false);
  const [result, setResult] = useState<Evaluation | null>(props.restored?.evaluation ?? null);

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
      <div className="flex flex-col gap-2">
        <Prompt>{exercise.prompt}</Prompt>
        {exercise.multiple && !result && <p className="text-[15px] text-muted">Vyber všechny správné.</p>}
      </div>
      <OptionList options={exercise.options} order={order} selected={selected} multiple={exercise.multiple} revealed={!!result} onToggle={toggle} />
      {!result && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GuessToggle checked={guessed} onChange={setGuessed} />
            <HintButton hint={exercise.hint} shown={hintUsed} onShow={() => setHintUsed(true)} />
          </div>
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={dontKnow}>
              Nevím
            </Button>
            <Button size="lg" className="flex-1 md:flex-none md:min-w-40" onClick={submit} disabled={!selected.length} kbd="↵">
              Potvrdit
            </Button>
          </ActionBar>
        </>
      )}
      {result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={props.reason === "new" || result.outcome !== "correct" || guessed}>
          <VerdictBadge verdict={result.outcome}>{result.outcome === "correct" && guessed ? "tip vyšel, zopakujeme to" : null}</VerdictBadge>
          {exercise.explanation && <p className="-mt-2 text-[15.5px] text-muted">{exercise.explanation}</p>}
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
  const [value, setValue] = useState(props.restored?.response.type === "numeric" ? props.restored.response.value : "");
  const [result, setResult] = useState<Evaluation | null>(props.restored?.evaluation ?? null);

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
        <form onSubmit={submit} className="flex flex-col gap-4">
          <NumberInput value={value} onChange={setValue} unit={exercise.unit} />
          <HintButton hint={exercise.hint} shown={hintUsed} onShow={() => setHintUsed(true)} />
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={dontKnow}>
              Nevím, ukaž postup
            </Button>
            <Button size="lg" type="submit" className="flex-1 md:flex-none md:min-w-40" disabled={!value.trim()} kbd="↵">
              Zkontrolovat
            </Button>
          </ActionBar>
        </form>
      )}
      {result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={props.reason === "new" || result.outcome !== "correct"}>
          <VerdictBadge verdict={result.outcome} />
          <Worked
            answer={`${fmt(result.expected ?? inst.answer, exercise.decimals)} ${exercise.unit}`}
            mine={result.outcome !== "unknown" ? value : null}
            steps={result.steps ?? inst.steps}
          />
        </FeedbackFooter>
      )}
    </>
  );
}

// ---------- explain ----------

function ExplainView(props: Props & { exercise: ExplainExercise }) {
  const { exercise, point, onNext } = props;
  const { record } = useRecorder(props);
  const prev = props.restored?.response.type === "explain" ? props.restored.response : null;
  const [phase, setPhase] = useState<"answer" | "check" | "dontKnow" | "done">(() =>
    !props.restored ? "answer" : props.restored.response.type === "dontKnow" ? "dontKnow" : "done",
  );
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState(prev?.text ?? "");
  const [covered, setCovered] = useState<number[]>(prev?.covered ?? []);
  const [result, setResult] = useState<Evaluation | null>(props.restored?.evaluation ?? null);
  const n = exercise.keyPoints.length;

  const finish = (c: number[]) => {
    setCovered(c);
    setResult(record({ type: "explain", covered: c, text: text.trim() || undefined }));
    setPhase("done");
  };
  const dontKnow = () => {
    record({ type: "dontKnow" });
    setPhase("dontKnow");
  };
  useKeys({ Space: () => setPhase("check") }, phase === "answer" && !writing);

  return (
    <>
      <Prompt>{exercise.prompt}</Prompt>
      {phase === "answer" && (
        <>
          <p className="text-[15.5px] text-muted">
            Zkus zmínit {plural(n, "hlavní bod", "hlavní body", "hlavních bodů")}. Odpověz nahlas, nebo{" "}
            {writing ? (
              "napiš odpověď."
            ) : (
              <>
                <button type="button" onClick={() => setWriting(true)} className="font-medium text-sage-600 underline underline-offset-4">
                  napiš odpověď
                </button>
                .
              </>
            )}
          </p>
          {writing && (
            <textarea
              rows={5}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-2xl border border-line-strong bg-card px-4 py-3 text-[16px] leading-relaxed outline-none focus:border-sage-600"
              placeholder="Tvoje odpověď…"
            />
          )}
          <ActionBar>
            <Button variant="ghost" size="lg" onClick={dontKnow}>
              Nevím
            </Button>
            <Button size="lg" className="flex-1 md:flex-none" onClick={() => setPhase("check")} kbd={writing ? undefined : "␣"} autoFocus={!writing}>
              Mám hotovo — porovnat
            </Button>
          </ActionBar>
        </>
      )}
      {phase === "check" && (
        <div className="flex flex-col gap-5 animate-rise">
          {text.trim() && <p className="rounded-2xl bg-card px-4 py-3 text-[15px] whitespace-pre-line text-muted ring-1 ring-line">{text}</p>}
          <KeyPointReview keyPoints={exercise.keyPoints} onDone={finish} />
        </div>
      )}
      {phase === "done" && result && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={result.outcome !== "correct"}>
          <VerdictBadge verdict={result.outcome}>
            {covered.length} z {n} bodů
          </VerdictBadge>
          <KeyPointResult keyPoints={exercise.keyPoints} covered={covered} modelAnswer={exercise.modelAnswer} />
        </FeedbackFooter>
      )}
      {phase === "dontKnow" && (
        <FeedbackFooter point={point} exerciseId={exercise.id} onNext={onNext} showExplanation={false}>
          <VerdictBadge verdict="unknown" />
          <Reading>{exercise.modelAnswer}</Reading>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15.5px] text-muted">
            {exercise.keyPoints.map((kp, i) => (
              <li key={i}>{kp}</li>
            ))}
          </ul>
        </FeedbackFooter>
      )}
    </>
  );
}
