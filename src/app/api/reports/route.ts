import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, authLearner } from "@/server/http";
import { addReport } from "@/server/store";

const Body = z.object({
  pointId: z.string().min(1).max(120),
  exerciseId: z.string().max(80).nullable(),
  message: z.string().max(2000),
});

export async function POST(req: Request) {
  const auth = await authLearner();
  if ("denied" in auth) return auth.denied;
  const { learner } = auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  await addReport(learner, parsed.data);
  return NextResponse.json({ ok: true });
}
