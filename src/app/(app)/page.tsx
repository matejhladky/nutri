"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useStudy } from "@/client/store";
import { dailyPlan } from "@/engine/planner";
import { pointStatus } from "@/engine/state";
import { Button, Panel } from "@/components/ui";
import { czDate, greeting, plural } from "@/lib/format";

export default function TodayPage() {
  const router = useRouter();
  const { states, settings, points, todayCards, pending, syncError } = useStudy();
  const now = useMemo(() => new Date(), []);

  const plan = useMemo(
    () => dailyPlan({ now, examDate: settings.examDate, points, states, dailyMinutes: settings.dailyMinutes }),
    [now, settings, points, states],
  );
  const core = points.filter((p) => p.tier !== "C");
  const seen = core.filter((p) => states.get(p.id)?.introducedAt).length;
  const solid = core.filter((p) => pointStatus(states.get(p.id)) === "solid").length;
  const newLeft = Math.max(0, plan.newTarget - plan.newToday);
  const started = todayCards > 0;

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting(now)}</h1>
        <p className="mt-1 text-muted">
          {settings.examDate ? (
            plan.daysLeft && plan.daysLeft > 0 ? (
              <>
                Do zkoušky zbývá <strong className="font-semibold text-ink">{plural(plan.daysLeft, "den", "dny", "dní")}</strong>{" "}
                <span className="text-faint">({czDate(settings.examDate)})</span>
              </>
            ) : (
              "Den zkoušky je tady. Hodně štěstí!"
            )
          ) : (
            <Link href="/nastaveni" className="text-sage-700 underline underline-offset-4">
              Nastav si datum zkoušky
            </Link>
          )}
        </p>
      </header>

      <Panel className="p-6">
        {plan.goalReached ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Dnešní plán je splněný</h2>
              <p className="mt-1 text-muted">
                {started ? `Dnes ${plural(todayCards, "karta", "karty", "karet")}. ` : ""}Opakování ti teď nejvíc pomůže zítra —
                paměť potřebuje odstup. Jestli máš chuť, můžeš ještě přidat nové poznatky.
              </p>
            </div>
            {plan.remainingNew > 0 && (
              <Button variant="secondary" onClick={() => router.push("/studium?navic=1")}>
                Pokračovat s novými poznatky
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold">{started ? "Pokračujeme" : "Dnešní plán"}</h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-[15px]">
                {plan.dueReviews > 0 && (
                  <li className="flex justify-between">
                    <span className="text-muted">K zopakování</span>
                    <span className="font-medium">{plural(plan.dueReviews, "poznatek", "poznatky", "poznatků")}</span>
                  </li>
                )}
                {newLeft > 0 && (
                  <li className="flex justify-between">
                    <span className="text-muted">Nové</span>
                    <span className="font-medium">{plural(newLeft, "poznatek", "poznatky", "poznatků")}</span>
                  </li>
                )}
                <li className="flex justify-between">
                  <span className="text-muted">Odhadem</span>
                  <span className="font-medium">{Math.max(5, plan.estimatedMinutes)} min</span>
                </li>
              </ul>
            </div>
            <Button size="lg" onClick={() => router.push("/studium")} autoFocus>
              {started ? "Pokračovat" : "Začít"}
            </Button>
            <p className="text-center text-xs text-faint">Můžeš kdykoli přestat — postup se ukládá průběžně.</p>
          </div>
        )}
      </Panel>

      <Link href="/pokrok" className="block">
        <Panel className="flex items-center justify-between p-5 hover:border-line-strong">
          <div>
            <div className="text-sm text-muted">Celkem probráno</div>
            <div className="mt-0.5 font-medium">
              {seen} z {core.length} poznatků
              {solid > 0 && <span className="text-muted"> · {solid} upevněno</span>}
            </div>
          </div>
          <span className="text-faint" aria-hidden>
            →
          </span>
        </Panel>
      </Link>

      {(pending > 0 || syncError) && (
        <p className="text-center text-xs text-faint">
          {syncError ? "Jsi offline — odpovědi se ukládají v zařízení a odešlou se později." : "Ukládám…"}
        </p>
      )}

      <div className="text-center">
        <Link href="/nastaveni" className="text-sm text-faint hover:text-muted">
          Nastavení
        </Link>
      </div>
    </div>
  );
}
