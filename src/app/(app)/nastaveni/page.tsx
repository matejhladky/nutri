"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudy } from "@/client/store";
import { Button, Panel } from "@/components/ui";
import { czDate } from "@/lib/format";
import { EXAM_DATE } from "@/lib/exam";

const MINUTES = [20, 30, 45, 60, 90];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, saveSettings } = useStudy();
  const [minutes, setMinutes] = useState(settings.dailyMinutes);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    try {
      await saveSettings({ dailyMinutes: minutes });
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-rise">
      <Link href="/" className="self-start text-sm text-muted hover:text-ink">
        ← Dnes
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
      <Panel className="p-5">
        <form onSubmit={save} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Zkouška: {czDate(EXAM_DATE)}</span>
            <span className="text-sm text-muted">Nové poznatky rozvrhuju tak, aby poslední dva dny zbyly na opakování.</span>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">Kolik času denně zhruba máš?</legend>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => {
                    setMinutes(m);
                    setState("idle");
                  }}
                  className={`min-h-11 rounded-xl border px-4 ${minutes === m ? "border-sage-600 bg-sage-50 font-medium text-sage-700" : "border-line-strong bg-card"}`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={state === "saving"}>
            {state === "saving" ? "Ukládám…" : state === "saved" ? "Uloženo ✓" : "Uložit"}
          </Button>
          {state === "error" && <p className="text-sm text-clay-600">Nepodařilo se uložit. Zkus to znovu.</p>}
        </form>
      </Panel>
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" });
            router.replace("/login");
          }}
        >
          Odhlásit se na tomto zařízení
        </Button>
      </div>
    </div>
  );
}
