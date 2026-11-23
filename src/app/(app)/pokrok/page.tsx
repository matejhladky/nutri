"use client";
import Link from "next/link";
import { useStudy } from "@/client/store";
import { pointStatus } from "@/engine/state";
import { content, topicsById } from "@/lib/content";
import { emptyCounts, STATUS_ORDER, StatusBar, StatusDot, statusMeta } from "@/components/StatusDot";

/** Competencies 1–4 are tested in writing, 5–11 orally and practically. */
const WRITTEN = new Set(["1", "2", "3", "4"]);

export default function ProgressPage() {
  const { points, states } = useStudy();
  const core = points.filter((p) => p.tier !== "C");

  const total = emptyCounts();
  for (const p of core) total[pointStatus(states.get(p.id), p)]++;

  // Per competency: points whose PRIMARY criterion belongs to it (no double counting).
  const rows = content.competencies.map((comp) => {
    const ids = new Set(comp.criteria.map((c) => c.id));
    const ps = core.filter((p) => ids.has(p.criteria[0]));
    const counts = emptyCounts();
    for (const p of ps) counts[pointStatus(states.get(p.id), p)]++;
    return { comp, ps, counts };
  });
  const groups = [
    { title: "Písemná zkouška", rows: rows.filter((r) => WRITTEN.has(r.comp.id)) },
    { title: "Ústní a praktická zkouška", rows: rows.filter((r) => !WRITTEN.has(r.comp.id)) },
  ];
  const weak = core.filter((p) => pointStatus(states.get(p.id), p) === "weak").slice(0, 5);

  return (
    <div className="flex flex-col gap-10 animate-rise">
      <h1 className="text-[28px] font-semibold tracking-tight lg:text-[34px]">Pokrok</h1>

      <section className="flex max-w-3xl flex-col gap-4">
        <StatusBar counts={total} />
        <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <StatusDot status={s} />
              <span className="text-muted">{statusMeta[s].label}</span>
              <span className="font-semibold tabular-nums">{total[s]}</span>
            </li>
          ))}
        </ul>
      </section>

      {weak.length > 0 && (
        <section className="max-w-3xl">
          <h2 className="mb-1 text-[15px] font-semibold text-muted">Potřebuje opakovat</h2>
          <ul>
            {weak.map((p) => (
              <li key={p.id}>
                <Link href={`/temata/${p.topicId}`} className="flex items-baseline gap-4 border-b border-line py-3 hover:text-sage-700">
                  <span className="flex-1 text-[16px] leading-snug">{p.title}</span>
                  <span className="hidden shrink-0 text-[13.5px] text-faint sm:inline">{topicsById.get(p.topicId)?.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-14">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-1 text-[15px] font-semibold text-muted">{g.title}</h2>
            <ul>
              {g.rows.map(({ comp, ps, counts }) => (
                <li key={comp.id} className="flex flex-col gap-2 border-b border-line py-3.5">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-[16px] leading-snug">{comp.title}</span>
                    <span className="shrink-0 text-[14px] tabular-nums text-faint">{ps.length ? `${ps.length - counts.new}/${ps.length}` : "—"}</span>
                  </span>
                  <StatusBar counts={counts} thin />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
