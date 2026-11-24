import { notFound } from "next/navigation";
import { isLearnerId } from "@/lib/learner";
import { adminLearners, learnerOverview, requireAdmin } from "@/server/admin";
import { LearnerOverview } from "@/components/admin/LearnerOverview";

export const dynamic = "force-dynamic";

export default async function LearnerPage({ params }: { params: Promise<{ learner: string }> }) {
  await requireAdmin();
  const { learner } = await params;
  if (!isLearnerId(learner) || !adminLearners().some((l) => l.id === learner)) notFound();
  return <LearnerOverview data={await learnerOverview(learner)} />;
}
