import { NextResponse } from "next/server";
import { badRequest, authLearner } from "@/server/http";
import { saveSettings, SettingsSchema } from "@/server/store";

export async function POST(req: Request) {
  const auth = await authLearner();
  if ("denied" in auth) return auth.denied;
  const { learner } = auth;
  const parsed = SettingsSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return NextResponse.json({ settings: await saveSettings(learner, parsed.data) });
}
