"use client";
import type { PointWithTopic } from "@/content/schema";
import { topicsById } from "@/lib/content";
import { ActionBar, Button, CardMeta } from "../ui";
import { NoteBox, Reading, SourceLine, useKeys } from "./shared";

/** Výklad — shown before the first retrieval of a new concept, procedure or case. */
export function IntroCard({
  point,
  onDone,
}: {
  point: PointWithTopic;
  onDone: (skipped: boolean) => void;
}) {
  useKeys({ Enter: () => onDone(false) });
  return (
    <div className="flex flex-col gap-6 animate-rise">
      <CardMeta badge="Nové">{topicsById.get(point.topicId)?.title}</CardMeta>
      <h2 className="text-[24px] font-semibold leading-tight tracking-tight md:text-[28px]">{point.title}</h2>
      <Reading className="!text-[18px] !leading-[1.7]">{point.explanation}</Reading>
      <NoteBox point={point} />
      <p className="text-[13.5px] text-faint">
        <SourceLine point={point} />
      </p>
      <ActionBar>
        <Button variant="ghost" size="lg" className="md:!px-5" onClick={() => onDone(true)}>
          Už to znám
        </Button>
        <Button size="lg" className="flex-1 md:flex-none md:min-w-40" onClick={() => onDone(false)} kbd="↵" autoFocus>
          Rozumím
        </Button>
      </ActionBar>
    </div>
  );
}
