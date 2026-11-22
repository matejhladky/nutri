"use client";
import type { PointWithTopic } from "@/content/schema";
import { topicsById } from "@/lib/content";
import { Button, Eyebrow } from "../ui";
import { NoteBox, SourceLine, useKeys } from "./shared";

/** Výklad — shown before the first retrieval of a new point. */
export function IntroCard({
  point,
  onDone,
}: {
  point: PointWithTopic;
  onDone: (skipped: boolean) => void;
}) {
  useKeys({ Enter: () => onDone(false) });
  return (
    <div className="flex flex-col gap-5 animate-rise">
      <div>
        <Eyebrow>Nové · {topicsById.get(point.topicId)?.title}</Eyebrow>
        <h2 className="mt-2 text-xl font-semibold leading-snug">{point.title}</h2>
      </div>
      <p className="text-[17px] leading-relaxed">{point.explanation}</p>
      <NoteBox point={point} />
      <SourceLine point={point} />
      <div className="mt-2 flex flex-col gap-2">
        <Button size="lg" onClick={() => onDone(false)} kbd="↵" autoFocus>
          Rozumím
        </Button>
        <Button variant="ghost" onClick={() => onDone(true)}>
          Tohle už znám — rovnou se zeptej
        </Button>
      </div>
      <p className="text-center text-xs text-faint">Za chvíli se tě na to zeptám.</p>
    </div>
  );
}
