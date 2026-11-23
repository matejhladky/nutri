"use client";
import Link from "next/link";
import { useStudy } from "@/client/store";
import { pointStatus } from "@/engine/state";
import { content } from "@/lib/content";
import type { PointWithTopic, Topic } from "@/content/schema";
import type { PointState } from "@/engine/types";
import { emptyCounts, StatusBar } from "@/components/StatusDot";

/** The script's chapters, grouped the way she would look for them. */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Živiny", ids: ["uvod", "sacharidy", "tuky", "bilkoviny", "alkohol", "vitaminy", "mineraly", "fyto-doporuceni"] },
  { title: "Tělo a metabolismus", ids: ["telo", "metabolismus"] },
  { title: "Práce s klientem", ids: ["poradenstvi", "energeticka-bilance", "nastaveni-jidelnicku", "prizpusobeni", "praxe", "pripady"] },
  { title: "Výživa v různých situacích", ids: ["pitny-rezim", "alternativni", "sport", "obdobi-zivota", "nemoci"] },
  { title: "Potraviny a doplňky", ids: ["potraviny", "doplnky"] },
];
const COLUMNS = [GROUPS.slice(0, 2), GROUPS.slice(2)];

export default function TopicsPage() {
  const { points, states } = useStudy();
  const byId = new Map(content.topics.map((t) => [t.id, t]));
  const grouped = new Set(GROUPS.flatMap((g) => g.ids));
  const rest = content.topics.filter((t) => !grouped.has(t.id));

  return (
    <div className="flex flex-col gap-8 animate-rise lg:gap-10">
      <h1 className="text-[28px] font-semibold tracking-tight lg:text-[34px]">Témata</h1>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-14">
        {COLUMNS.map((col, i) => (
          <div key={i} className="flex flex-col gap-10">
            {col.map((g) => (
              <section key={g.title}>
                <h2 className="mb-1 text-[15px] font-semibold text-muted">{g.title}</h2>
                <ul>
                  {g.ids.flatMap((id) => (byId.get(id) ? [<Row key={id} t={byId.get(id)!} points={points} states={states} />] : []))}
                </ul>
                {g.title === "Práce s klientem" && (
                  <Link href="/priprava" className="mt-4 inline-block text-[15px] font-semibold text-sage-600 hover:underline">
                    Co trénovat naživo
                  </Link>
                )}
              </section>
            ))}
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <section>
          <h2 className="mb-1 text-[15px] font-semibold text-muted">Další</h2>
          <ul>
            {rest.map((t) => (
              <Row key={t.id} t={t} points={points} states={states} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ t, points, states }: { t: Topic; points: PointWithTopic[]; states: Map<string, PointState> }) {
  const ps = points.filter((p) => p.topicId === t.id);
  const counts = emptyCounts();
  for (const p of ps) counts[pointStatus(states.get(p.id), p)]++;
  return (
    <li>
      <Link href={`/temata/${t.id}`} className="group flex flex-col gap-2 border-b border-line py-3.5">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-[16.5px] leading-snug group-hover:text-sage-700">{t.title}</span>
          <span className="shrink-0 text-[14px] tabular-nums text-faint">
            {ps.length - counts.new}/{ps.length}
          </span>
        </span>
        <StatusBar counts={counts} thin />
      </Link>
    </li>
  );
}
