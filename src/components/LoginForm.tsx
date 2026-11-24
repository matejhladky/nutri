"use client";
import { useState } from "react";
import { Button, Panel } from "@/components/ui";

/** Passphrase login. On success, a full page load of `next` (nothing from a previous session stays in memory). */
export function LoginForm({ endpoint, next, subtitle }: { endpoint: string; next: string; subtitle: string }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        window.location.replace(next);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Přihlášení se nepovedlo.");
    } catch {
      setError("Nepodařilo se spojit se serverem. Zkus to za chvíli.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="mb-8">
        <div className="font-serif text-[34px] font-semibold text-sage-700">Nutri</div>
        <p className="mt-1 text-muted">{subtitle}</p>
      </div>
      <Panel className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Heslo</span>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="min-h-12 rounded-[14px] border border-line-strong bg-paper px-4 text-base outline-none focus:border-sage-600"
            />
          </label>
          {error && (
            <p className="text-sm text-clay-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !passphrase}>
            {busy ? "Přihlašuji…" : "Vstoupit"}
          </Button>
        </form>
      </Panel>
    </main>
  );
}
