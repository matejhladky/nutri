import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, denyUnlessAuthed } from "@/server/http";
import { addEvents, EventSchema } from "@/server/store";
import type { StudyEvent } from "@/engine/types";

const Body = z.object({ events: z.array(EventSchema).min(1).max(500) });

/** Idempotent: re-sending the same event ids is harmless. Returns the rebuilt states of affected points. */
export async function POST(req: Request) {
  const denied = await denyUnlessAuthed();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const states = await addEvents(parsed.data.events as StudyEvent[]);
  return NextResponse.json({ states });
}
