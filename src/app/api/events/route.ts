import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, denyUnlessAuthed } from "@/server/http";
import { addEvents, partitionEvents } from "@/server/store";

const Body = z.object({ events: z.array(z.unknown()).min(1).max(500) });

/**
 * Idempotent: re-sending the same event ids is harmless. Events are validated one by one; invalid ones are
 * returned in `rejected` (the client drops them) so they cannot block the queue. Returns the rebuilt states of
 * affected points.
 */
export async function POST(req: Request) {
  const denied = await denyUnlessAuthed();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { valid, rejected } = partitionEvents(parsed.data.events);
  if (rejected.length) console.warn("rejected events", JSON.stringify(rejected));
  const states = valid.length ? await addEvents(valid) : {};
  return NextResponse.json({ states, rejected });
}
