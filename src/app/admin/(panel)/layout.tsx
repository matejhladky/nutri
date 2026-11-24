import { adminLearners, requireAdmin } from "@/server/admin";
import { AdminFrame } from "@/components/admin/AdminFrame";

export const metadata = { title: "Nutri — správa", robots: { index: false } };

/** Admin area: read-only overview of each learner + content explorer. Checked here again after the proxy. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminFrame learners={adminLearners()}>{children}</AdminFrame>;
}
