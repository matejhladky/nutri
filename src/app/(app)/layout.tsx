import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StudyProvider } from "@/client/store";
import { AppFrame } from "@/components/AppFrame";
import { getLearner } from "@/server/learners";
import { SESSION_COOKIE, verifySessionToken } from "@/server/session";

/** Rendered per request for the learner in the session cookie; everything below is scoped to her. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const id = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) redirect("/login");
  return (
    <StudyProvider key={id} learner={getLearner(id)}>
      <AppFrame>{children}</AppFrame>
    </StudyProvider>
  );
}
