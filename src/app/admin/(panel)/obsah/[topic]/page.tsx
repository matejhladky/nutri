import Link from "next/link";
import { notFound } from "next/navigation";
import { content, topicsById } from "@/lib/content";
import { Icon } from "@/components/ui";
import { PointDetail } from "@/components/admin/PointDetail";

export default async function AdminTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: id } = await params;
  const topic = topicsById.get(id);
  if (!topic) notFound();
  const points = content.points.filter((p) => p.topicId === id);
  return (
    <div className="flex flex-col gap-7 animate-rise">
      <Link href="/admin/obsah" className="-ml-1 flex items-center gap-1 self-start text-[15px] text-muted hover:text-ink">
        <Icon name="back" size={18} />
        Obsah
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight lg:text-[36px]">{topic.title}</h1>
        <p className="text-[14px] text-faint">
          {topic.chapter ? `Kapitola ${topic.chapter}, ` : ""}skripta s. {topic.pages[0]}–{topic.pages[1]}
        </p>
        <p className="mt-1 max-w-3xl text-muted">{topic.summary}</p>
      </header>
      <div className="flex flex-col">
        {points.map((p) => (
          <PointDetail key={p.id} point={p} />
        ))}
      </div>
    </div>
  );
}
