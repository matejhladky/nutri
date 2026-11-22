"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useStudy } from "@/client/store";
import { pointStatus } from "@/engine/state";
import { criterionInfo, pagesLabel, topicsById } from "@/lib/content";
import { Panel } from "@/components/ui";
import { StatusDot, statusMeta } from "@/components/StatusDot";

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const { points, states } = useStudy();
  const topic = topicsById.get(id);
  if (!topic) notFound();
  const ps = points.filter((p) => p.topicId === id);
  const criteria = [...new Set(ps.flatMap((p) => p.criteria))].sort((a, b) => a.localeCompare(b, "cs", { numeric: true }));

  return (
    <div className="flex flex-col gap-5 animate-rise">
      <Link href="/temata" className="self-start text-sm text-muted hover:text-ink">
        ← Témata
      </Link>
      <header>
        <div className="text-sm text-faint">
          {topic.chapter ? `Kapitola ${topic.chapter} · ` : ""}skripta s. {topic.pages[0]}–{topic.pages[1]}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{topic.title}</h1>
        <p className="mt-2 text-muted">{topic.summary}</p>
      </header>

      <Link
        href={`/studium?tema=${topic.id}`}
        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-sage-600 px-5 font-medium text-white shadow-sm hover:bg-sage-700"
      >
        Procvičit toto téma
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">Poznatky</h2>
        <ul className="flex flex-col gap-2">
          {ps.map((p) => {
            const st = pointStatus(states.get(p.id));
            return (
              <li key={p.id}>
                <Panel className="p-0">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <StatusDot status={st} />
                      <span className="flex-1 font-medium leading-snug">{p.title}</span>
                      {p.tier === "C" && <span className="text-xs text-faint">doplňkové</span>}
                      <span className="text-faint transition-transform group-open:rotate-90" aria-hidden>
                        ›
                      </span>
                    </summary>
                    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 text-[15px] leading-relaxed">
                      <p>{p.explanation}</p>
                      {p.note && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
                          <span className="font-semibold text-amber-600">Pozn.: </span>
                          {p.note}
                        </p>
                      )}
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-faint">
                        <span>Skripta {pagesLabel(p.source.pages)}</span>
                        <span>{statusMeta[st].label}</span>
                      </div>
                    </div>
                  </details>
                </Panel>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">Kritéria zkoušky</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          {criteria.map((c) => {
            const info = criterionInfo(c);
            return (
              <li key={c}>
                <span className="mr-2 font-medium text-ink tabular-nums">{c}</span>
                {info?.criterion.label}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
