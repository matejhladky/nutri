"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useStudy } from "@/client/store";
import { pointStatus } from "@/engine/state";
import { pagesLabel, topicsById } from "@/lib/content";
import { Icon } from "@/components/ui";
import { StatusDot, statusMeta } from "@/components/StatusDot";
import { NoteBox, Reading } from "@/components/study/shared";

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const { points, states } = useStudy();
  const topic = topicsById.get(id);
  if (!topic) notFound();
  const ps = points.filter((p) => p.topicId === id);

  return (
    <div className="flex flex-col gap-7 animate-rise lg:max-w-3xl">
      <Link href="/temata" className="-ml-1 flex items-center gap-1 self-start text-[15px] text-muted hover:text-ink">
        <Icon name="back" size={18} />
        Témata
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight lg:text-[34px]">{topic.title}</h1>
        <p className="text-[14px] text-faint">
          {topic.chapter ? `Kapitola ${topic.chapter}, ` : ""}skripta s. {topic.pages[0]}–{topic.pages[1]}
        </p>
        <p className="mt-1 max-w-2xl text-muted">{topic.summary}</p>
      </header>

      <Link
        href={`/studium?tema=${topic.id}`}
        className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-sage-600 px-7 font-semibold text-white hover:bg-sage-700 sm:self-start"
      >
        Procvičit toto téma
      </Link>

      <ul className="border-t border-line">
        {ps.map((p) => {
          const st = pointStatus(states.get(p.id), p);
          return (
            <li key={p.id} className="border-b border-line">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3.5 py-3.5 hover:text-sage-700">
                  <StatusDot status={st} />
                  <span className="flex-1 text-[16.5px] leading-snug">{p.title}</span>
                  {p.tier === "C" && <span className="text-[13px] text-faint">doplňkové</span>}
                  <span className="text-faint transition-transform group-open:rotate-90">
                    <Icon name="chevron" size={16} />
                  </span>
                </summary>
                <div className="flex flex-col gap-4 pb-5 pl-6">
                  <Reading className="!text-[16.5px]">{p.explanation}</Reading>
                  <NoteBox point={p} />
                  <p className="text-[13.5px] text-faint">
                    Skripta {pagesLabel(p.source.pages)}, {statusMeta[st].label.toLowerCase()}
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
