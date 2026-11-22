"use client";
import Link from "next/link";
import { useStudy } from "@/client/store";
import { pointStatus } from "@/engine/state";
import { content } from "@/lib/content";
import { Panel } from "@/components/ui";
import { emptyCounts, StatusBar } from "@/components/StatusDot";

export default function TopicsPage() {
  const { points, states } = useStudy();
  return (
    <div className="flex flex-col gap-5 animate-rise">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Témata</h1>
        <p className="mt-1 text-muted">Kapitoly ze skript — přehled poznatků a procvičení jednoho tématu.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {content.topics.map((t) => {
          const ps = points.filter((p) => p.topicId === t.id);
          const counts = emptyCounts();
          for (const p of ps) counts[pointStatus(states.get(p.id))]++;
          return (
            <li key={t.id}>
              <Link href={`/temata/${t.id}`} className="block">
                <Panel className="flex flex-col gap-3 p-5 hover:border-line-strong">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-semibold">
                      <span className="mr-2 text-faint tabular-nums">{t.chapter}.</span>
                      {t.title}
                    </h2>
                    <span className="shrink-0 text-sm text-muted tabular-nums">
                      {ps.length - counts.new}/{ps.length}
                    </span>
                  </div>
                  <StatusBar counts={counts} />
                </Panel>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
