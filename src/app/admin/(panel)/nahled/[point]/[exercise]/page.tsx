"use client";
/**
 * Sandboxed preview of one exercise as the learner sees it. Runs on PreviewProvider: answers are evaluated and shown
 * on this page only — nothing is queued, sent or stored, and no learner's state is involved.
 */
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PreviewProvider } from "@/client/store";
import { newSeed } from "@/client/session";
import { content, pointsById, topicsById } from "@/lib/content";
import { EXAM_DATE } from "@/lib/exam";
import { ExerciseCard } from "@/components/study/ExerciseCard";
import { IntroCard } from "@/components/study/IntroCard";
import { Icon } from "@/components/ui";
import { TYPE_LABEL } from "@/components/admin/PointDetail";

export default function PreviewPage() {
  const params = useParams<{ point: string; exercise: string }>();
  const router = useRouter();
  const point = pointsById.get(decodeURIComponent(params.point));
  const exercise = point?.exercises.find((e) => e.id === decodeURIComponent(params.exercise));
  const [seed, setSeed] = useState(newSeed);
  const [intro, setIntro] = useState(false);
  if (!point || !exercise) notFound();

  // All exercises of the topic, in order — to step through them.
  const all = content.points.filter((p) => p.topicId === point.topicId).flatMap((p) => p.exercises.map((e) => ({ p, e })));
  const i = all.findIndex((x) => x.p.id === point.id && x.e.id === exercise.id);
  const go = (j: number) => all[j] && router.push(`/admin/nahled/${all[j].p.id}/${all[j].e.id}`);

  return (
    <div className="flex flex-col gap-8 lg:mx-auto lg:max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[15px]">
        <Link href={`/admin/obsah/${point.topicId}#${point.id}`} className="-ml-1 flex items-center gap-1 text-muted hover:text-ink">
          <Icon name="back" size={18} />
          {topicsById.get(point.topicId)?.title}
        </Link>
        <span className="flex items-center gap-1">
          <PillButton onClick={() => go(i - 1)} disabled={i <= 0} label="Předchozí otázka">
            <Icon name="back" size={16} />
          </PillButton>
          <span className="px-2 text-faint tabular-nums">
            {i + 1} / {all.length}
          </span>
          <PillButton onClick={() => go(i + 1)} disabled={i >= all.length - 1} label="Další otázka">
            <Icon name="chevron" size={16} />
          </PillButton>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 border-b border-line pb-4 text-[14px]">
        <span className="w-full text-faint sm:mr-auto sm:w-auto">
          Náhled: {TYPE_LABEL[exercise.type].toLowerCase()}, nic se neukládá
        </span>
        <Toggle on={intro} onClick={() => setIntro(true)}>
          Výklad
        </Toggle>
        <Toggle on={!intro} onClick={() => setIntro(false)}>
          Otázka
        </Toggle>
        <button type="button" onClick={() => (setIntro(false), setSeed(newSeed()))} className="rounded-full px-3 py-1.5 text-sage-700 hover:bg-sage-50">
          Znovu
        </button>
      </div>

      <PreviewProvider examDate={EXAM_DATE}>
        {intro ? (
          <IntroCard point={point} onDone={() => setIntro(false)} />
        ) : (
          <ExerciseCard
            key={`${point.id}/${exercise.id}/${seed}`}
            point={point}
            exercise={exercise}
            seed={seed}
            reason="new"
            onRecord={() => {}}
            onNext={() => (i < all.length - 1 ? go(i + 1) : setSeed(newSeed()))}
          />
        )}
      </PreviewProvider>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 ${on ? "bg-sage-700 font-medium text-cream" : "text-muted hover:bg-ink/[0.04] hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function PillButton({ onClick, disabled, label, children }: { onClick: () => void; disabled: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full p-2 text-muted hover:bg-ink/[0.04] hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
