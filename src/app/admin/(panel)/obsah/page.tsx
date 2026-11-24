import Link from "next/link";
import { content } from "@/lib/content";
import { plural } from "@/lib/format";

export default function ContentPage() {
  const byTopic = new Map<string, { points: number; exercises: number }>();
  for (const p of content.points) {
    const c = byTopic.get(p.topicId) ?? { points: 0, exercises: 0 };
    c.points++;
    c.exercises += p.exercises.length;
    byTopic.set(p.topicId, c);
  }
  return (
    <div className="flex flex-col gap-8 animate-rise">
      <h1 className="text-[30px] font-semibold tracking-tight lg:text-[36px]">Obsah</h1>
      <ul className="grid lg:grid-cols-2 lg:gap-x-14">
        {[...content.topics]
          .sort((a, b) => a.order - b.order)
          .map((t) => {
            const c = byTopic.get(t.id) ?? { points: 0, exercises: 0 };
            return (
              <li key={t.id}>
                <Link href={`/admin/obsah/${t.id}`} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 hover:text-sage-700">
                  <span className="text-[16px] leading-snug">
                    {t.chapter && <span className="mr-2 text-faint tabular-nums">{t.chapter}</span>}
                    {t.title}
                  </span>
                  <span className="shrink-0 text-[13.5px] text-faint tabular-nums">
                    {plural(c.points, "poznatek", "poznatky", "poznatků")}, {plural(c.exercises, "otázka", "otázky", "otázek")}
                  </span>
                </Link>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
