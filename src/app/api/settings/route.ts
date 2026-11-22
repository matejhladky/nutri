import { NextResponse } from "next/server";
import { badRequest, denyUnlessAuthed } from "@/server/http";
import { saveSettings, SettingsSchema } from "@/server/store";

export async function POST(req: Request) {
  const denied = await denyUnlessAuthed();
  if (denied) return denied;
  const parsed = SettingsSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return NextResponse.json({ settings: await saveSettings(parsed.data) });
}
