import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, denyUnlessAuthed } from "@/server/http";
import { addReport } from "@/server/store";

const Body = z.object({
  pointId: z.string().min(1).max(120),
  exerciseId: z.string().max(80).nullable(),
  message: z.string().max(2000),
});

export async function POST(req: Request) {
  const denied = await denyUnlessAuthed();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  await addReport(parsed.data);
  return NextResponse.json({ ok: true });
}
