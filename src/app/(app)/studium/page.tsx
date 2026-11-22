"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { StudyScreen } from "@/components/study/StudyScreen";
import type { StudyMode } from "@/client/session";
import { topicsById } from "@/lib/content";

function Study() {
  const params = useSearchParams();
  const topic = params.get("tema");
  const mode = useMemo<StudyMode>(() => (topic && topicsById.has(topic) ? { kind: "topic", topicId: topic } : { kind: "daily" }), [topic]);
  return <StudyScreen key={topic ?? "daily"} mode={mode} beyondGoal={params.get("navic") === "1"} />;
}

export default function StudyPage() {
  return (
    <Suspense>
      <Study />
    </Suspense>
  );
}
