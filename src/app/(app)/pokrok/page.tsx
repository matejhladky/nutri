"use client";
import Link from "next/link";
import { useStudy } from "@/client/store";
import { pointStatus, type PointStatus } from "@/engine/state";
import { content, topicsById } from "@/lib/content";
import { Panel } from "@/components/ui";
import { plural } from "@/lib/format";
import { emptyCounts, StatusBar, StatusDot, statusMeta } from "@/components/StatusDot";

const METHOD_LABEL = { P: "písemně", U: "ústně", PR: "prakticky" } as const;

export default function ProgressPage() {
  const { points, states, todayCards } = useStudy();
  const core = points.filter((p) => p.tier !== "C");

  const total = emptyCounts();
  for (const p of core) total[pointStatus(states.get(p.id), p)]++;

  // Per competency: points whose PRIMARY criterion belongs to it (no double counting).
  const rows = content.competencies.map((comp) => {
    const ids = new Set(comp.criteria.map((c) => c.id));
    const ps = core.filter((p) => ids.has(p.criteria[0]));
    const counts = emptyCounts();
    for (const p of ps) counts[pointStatus(states.get(p.id), p)]++;
    const methods = [...new Set(comp.criteria.flatMap((c) => c.method))];
    return { comp, ps, counts, methods };
  });

  const weak = core.filter((p) => pointStatus(states.get(p.id), p) === "weak").slice(0, 10);

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pokrok</h1>
        <p className="mt-1 text-muted">Kolik látky už máš za sebou a co si zaslouží pozornost.</p>
      </header>

      <Panel className="flex flex-col gap-4 p-5">
        <StatusBar counts={total} />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {(["solid", "learning", "weak", "new"] as PointStatus[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <StatusDot status={s} />
              <span className="text-muted">{statusMeta[s].label}</span>
              <span className="ml-auto font-medium tabular-nums">{total[s]}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-faint">
          „Upevněno“ = naposledy vybaveno bez nápovědy a bez tipování, aspoň den po prvním setkání (a u poznatků, které
          mají otázku na vlastní vybavení, aspoň jednou právě takovou odpovědí). Dnes {plural(todayCards, "odpověď", "odpovědi", "odpovědí")}.
        </p>
      </Panel>

      {weak.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">Potřebuje opakovat</h2>
          <Panel className="divide-y divide-line">
            {weak.map((p) => (
              <Link key={p.id} href={`/temata/${p.topicId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                <StatusDot status="weak" />
                <span className="flex-1 leading-snug">{p.title}</span>
                <span className="text-xs text-faint">{topicsById.get(p.topicId)?.title}</span>
              </Link>
            ))}
          </Panel>
          <p className="mt-2 text-xs text-faint">Tyhle poznatky ti plán sám zařadí znovu — nemusíš nic dělat.</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">Podle kompetencí zkoušky</h2>
        <ul className="flex flex-col gap-2">
          {rows.map(({ comp, ps, counts, methods }) => (
            <li key={comp.id}>
              <Panel className="flex flex-col gap-2.5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="leading-snug">
                    <span className="mr-2 text-faint tabular-nums">{comp.id}.</span>
                    <span className="font-medium">{comp.title}</span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{ps.length ? `${ps.length - counts.new}/${ps.length}` : "—"}</span>
                </div>
                {ps.length ? <StatusBar counts={counts} /> : <p className="text-xs text-faint">Otázky k této kompetenci se připravují.</p>}
                <div className="text-xs text-faint">Ověřuje se {methods.map((m) => METHOD_LABEL[m]).join(", ")}</div>
              </Panel>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
