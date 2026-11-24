/**
 * Content explorer: one point with everything behind it — Výklad, note, source, links, and each exercise with its
 * answer key. Numeric exercises and cases are shown with one example client (seed 1).
 */
import Link from "next/link";
import type { ChoiceExercise, Exercise, PointWithTopic } from "@/content/schema";
import { fmt, instantiate, instantiateCase } from "@/content/formulas";
import { criterionInfo, pagesLabel, pointsById } from "@/lib/content";
import { NoteBox, Reading } from "@/components/study/shared";
import { Icon } from "@/components/ui";

export const TYPE_LABEL: Record<Exercise["type"], string> = {
  choice: "Výběr",
  reveal: "Vybavení",
  numeric: "Výpočet",
  explain: "Vysvětlení nahlas",
  case: "Modelový případ",
};
const KIND: Record<PointWithTopic["kind"], string> = { fact: "fakt", concept: "pojem", comparison: "srovnání", procedure: "postup" };
const STATUS: Record<PointWithTopic["status"], string | null> = { course: null, "course-disputed": "skripta se liší", supplementary: "nad rámec skript" };

export function PointDetail({ point }: { point: PointWithTopic }) {
  const tags = [`tier ${point.tier}`, KIND[point.kind], point.safety ? "bezpečnost" : null, STATUS[point.status]].filter(Boolean);
  const links = (ids: string[]) => ids.flatMap((id) => (pointsById.get(id) ? [pointsById.get(id)!] : []));
  return (
    <details id={point.id} className="group scroll-mt-24 border-b border-line">
      <summary className="flex cursor-pointer items-baseline gap-4 py-4 hover:text-sage-700">
        <span className="flex-1 text-[17px] font-medium leading-snug">{point.title}</span>
        <span className="hidden shrink-0 text-[13.5px] text-faint sm:inline">{tags.join(", ")}</span>
        <span className="shrink-0 self-center text-faint transition-transform group-open:rotate-90">
          <Icon name="chevron" size={16} />
        </span>
      </summary>
      <div className="flex flex-col gap-6 pb-8">
        <p className="text-[13.5px] text-faint sm:hidden">{tags.join(", ")}</p>
        <Reading className="max-w-3xl">{point.explanation}</Reading>
        <NoteBox point={point} />
        <dl className="grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-[auto_1fr]">
          <dt className="text-faint">Zdroj</dt>
          <dd>
            Skripta {pagesLabel(point.source.pages)}
            {point.source.anchor && <span className="text-muted"> („{point.source.anchor}“)</span>}
          </dd>
          <dt className="text-faint">Kritéria</dt>
          <dd>{point.criteria.map((c) => `${c} ${criterionInfo(c)?.criterion.label ?? ""}`.trim()).join("; ")}</dd>
          {point.prereqs.length > 0 && (
            <>
              <dt className="text-faint">Navazuje na</dt>
              <dd>{links(point.prereqs).map((q) => <PointLink key={q.id} p={q} />)}</dd>
            </>
          )}
          {point.confusableWith.length > 0 && (
            <>
              <dt className="text-faint">Nezaměnit s</dt>
              <dd>{links(point.confusableWith).map((q) => <PointLink key={q.id} p={q} />)}</dd>
            </>
          )}
        </dl>
        <ol className="flex flex-col gap-4">
          {point.exercises.map((e) => (
            <li key={e.id} className="rounded-2xl border border-line bg-card p-5">
              <ExerciseDetail point={point} exercise={e} />
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

function PointLink({ p }: { p: PointWithTopic }) {
  return (
    <Link href={`/admin/obsah/${p.topicId}#${p.id}`} className="mr-3 text-sage-700 underline-offset-4 hover:underline">
      {p.title}
    </Link>
  );
}

function ExerciseDetail({ point, exercise: e }: { point: PointWithTopic; exercise: Exercise }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13.5px] text-faint">
          {TYPE_LABEL[e.type]}
          {e.type === "choice" && e.multiple ? ", více odpovědí" : ""}
          {e.version > 1 ? `, verze ${e.version}` : ""}
        </span>
        <Link href={`/admin/nahled/${point.id}/${e.id}`} className="shrink-0 text-[14.5px] font-semibold text-sage-600 hover:underline">
          Vyzkoušet
        </Link>
      </div>
      <Body e={e} />
      {e.hint && <Line label="Nápověda">{e.hint}</Line>}
    </div>
  );
}

function Body({ e }: { e: Exercise }) {
  switch (e.type) {
    case "choice":
      return (
        <>
          <p className="text-[16.5px] font-medium leading-snug">{e.prompt}</p>
          <Options options={e.options} />
          {e.explanation && <Line label="Vysvětlení">{e.explanation}</Line>}
        </>
      );
    case "reveal":
      return (
        <>
          <p className="text-[16.5px] font-medium leading-snug">{e.prompt}</p>
          <Line label="Odpověď">{e.answer}</Line>
        </>
      );
    case "numeric": {
      const inst = instantiate(e, 1);
      return (
        <>
          <p className="text-[16.5px] font-medium leading-snug">{inst.prompt}</p>
          <Line label="Výsledek">
            {fmt(inst.answer, e.decimals)} {e.unit}
            <span className="text-faint"> (příklad; tolerance {tol(e.tolerance)})</span>
          </Line>
          {inst.steps.length > 0 && <Steps steps={inst.steps} />}
        </>
      );
    }
    case "explain":
      return (
        <>
          <p className="text-[16.5px] font-medium leading-snug">{e.prompt}</p>
          <Line label="Hlavní body">
            <ul className="list-disc pl-5">
              {e.keyPoints.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </Line>
          <Line label="Vzorová odpověď">{e.modelAnswer}</Line>
        </>
      );
    case "case": {
      const inst = instantiateCase(e, 1);
      return (
        <>
          <p className="text-[16.5px] leading-snug">{inst.prompt}</p>
          <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
            {e.steps.map((s, i) => (
              <li key={i} className="flex flex-col gap-1.5 text-[15px]">
                <span>
                  <span className="mr-2 text-faint tabular-nums">{i + 1}.</span>
                  {inst.steps[i].prompt}
                </span>
                {s.type === "choice" && <Options options={s.options} />}
                {s.type === "reveal" && <Line label="Odpověď">{s.answer}</Line>}
                {s.type === "explain" && <Line label="Hlavní body">{s.keyPoints.join("; ")}</Line>}
                {(() => {
                  const st = inst.steps[i];
                  return st.type === "numeric" && s.type === "numeric" ? (
                    <Line label="Výsledek">
                      {fmt(st.answer, s.decimals)} {s.unit}
                    </Line>
                  ) : null;
                })()}
              </li>
            ))}
          </ol>
        </>
      );
    }
  }
}

const tol = (t: { abs?: number; rel?: number }) => [t.abs !== undefined ? `±${t.abs}` : null, t.rel !== undefined ? `±${Math.round(t.rel * 100)} %` : null].filter(Boolean).join(" / ") || "přesně";

function Options({ options }: { options: ChoiceExercise["options"] }) {
  return (
    <ul className="flex flex-col gap-2">
      {options.map((o, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
          <span className={`mt-0.5 shrink-0 ${o.correct ? "text-sage-600" : "text-line-strong"}`} aria-label={o.correct ? "správně" : "špatně"}>
            {o.correct ? <Icon name="check" size={17} /> : <Icon name="close" size={17} />}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className={o.correct ? "font-medium" : ""}>{o.text}</span>
            {o.why && <span className="text-[14px] text-muted">{o.why}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-[15px] leading-snug">
      <span className="mr-2 text-[13.5px] text-faint">{label}</span>
      <span className="text-ink/90">{children}</span>
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-0.5 border-l-2 border-line pl-4 text-[14px] text-muted tabular-nums">
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}
