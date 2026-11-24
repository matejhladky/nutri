"use client";
import { useMemo } from "react";
import { useStudy } from "@/client/store";
import { ActivitySection, CompetencyGroups, corePoints, countStatuses, StatusOverview, WeakList } from "@/components/Progress";

export default function ProgressPage() {
  const { points, states, answersByDay } = useStudy();
  const now = useMemo(() => new Date(), []);
  const core = corePoints(points);

  return (
    <div className="flex flex-col gap-10 animate-rise">
      <h1 className="text-[28px] font-semibold tracking-tight lg:text-[34px]">Pokrok</h1>
      <ActivitySection points={points} states={states} answersByDay={answersByDay} now={now} />
      <StatusOverview counts={countStatuses(core, states)} />
      <WeakList core={core} states={states} />
      <CompetencyGroups core={core} states={states} />
    </div>
  );
}
