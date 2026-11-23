"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useStudy } from "@/client/store";
import { dailyPlan } from "@/engine/planner";
import { pointStatus } from "@/engine/state";
import { examCountdown } from "@/components/AppFrame";
import { emptyCounts, StatusBar } from "@/components/StatusDot";
import { Icon } from "@/components/ui";
import { greeting, plural } from "@/lib/format";
import { EXAM_DATE } from "@/lib/exam";

const clock = (iso: string) => new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });

export default function TodayPage() {
  const router = useRouter();
  const { states, settings, points, todayCards, pending, syncError, retrievability, timing } = useStudy();
  const now = useMemo(() => new Date(), []);

  const plan = useMemo(
    () => dailyPlan({ now, examDate: EXAM_DATE, points, states, dailyMinutes: settings.dailyMinutes, retrievability, timing }),
    [now, settings, points, states, retrievability, timing],
  );
  const core = points.filter((p) => p.tier !== "C");
  const counts = emptyCounts();
  for (const p of core) counts[pointStatus(states.get(p.id), p)]++;
  const seen = core.length - counts.new;

  const reviews = plan.dueReviews + plan.learningDue;
  const newLeft = Math.max(0, plan.newTarget - plan.newToday);
  const started = todayCards > 0;
  const finalDays = plan.daysLeft !== null && plan.daysLeft <= 2;
  const sweepOnly = finalDays || plan.remainingNew === 0;
  const examDay = plan.daysLeft !== null && plan.daysLeft <= 0;

  const parts = [
    reviews > 0 ? `${reviews} opakování` : null,
    newLeft > 0 ? plural(newLeft, "nový poznatek", "nové poznatky", "nových poznatků") : null,
  ].filter(Boolean);
  const summary = parts.length ? parts.join(" a ") : "Pár krátkých opakování";

  return (
    <div className="flex flex-col gap-8 animate-rise lg:mx-auto lg:w-full lg:max-w-3xl lg:gap-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight lg:text-[34px]">{greeting(now)}</h1>
          <p className="mt-1 text-muted lg:hidden">{examDay ? "Dnes je zkouška. Hodně štěstí!" : `Zkouška ${examCountdown(now)}, v pátek 4. 12.`}</p>
        </div>
        <Link href="/nastaveni" aria-label="Nastavení" className="-mr-2 rounded-xl p-2 text-faint hover:text-ink lg:hidden">
          <Icon name="settings" size={22} />
        </Link>
      </header>

      <section aria-label="Dnešní plán" className="flex flex-col gap-7 rounded-[26px] bg-sage-700 px-6 py-7 text-cream md:px-10 md:py-10">
        {plan.goalReached ? (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="font-serif text-[26px] font-medium leading-tight md:text-[32px]">Dnešní plán je splněný</h2>
              <p className="text-sage-200">
                {plan.laterToday > 0 && plan.nextLaterAt
                  ? `Později ještě ${plural(plan.laterToday, "krátké opakování", "krátká opakování", "krátkých opakování")}, kolem ${clock(plan.nextLaterAt)}.`
                  : finalDays
                    ? "Nové poznatky už nepřibývají. Můžeš si procvičit nejslabší místa."
                    : "Další opakování přijdou zítra."}
              </p>
            </div>
            {(plan.remainingNew > 0 || seen > 0) && (
              <button
                type="button"
                onClick={() => router.push("/studium?navic=1")}
                className="min-h-[52px] self-start rounded-2xl border border-cream/40 px-6 font-semibold hover:bg-cream/10"
              >
                {sweepOnly ? "Pokračovat: procvičit nejslabší místa" : "Pokračovat s novými poznatky"}
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="max-w-xl font-serif text-[26px] font-medium leading-[1.25] md:text-[32px]">{summary}</h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                type="button"
                autoFocus
                onClick={() => router.push("/studium")}
                className="min-h-14 flex-1 rounded-2xl bg-cream px-10 text-[18px] font-bold text-sage-700 hover:bg-white sm:flex-none"
              >
                {started ? "Pokračovat" : "Začít"}
              </button>
              <span className="text-sage-200">asi {Math.max(5, plan.estimatedMinutes)} minut</span>
            </div>
            {plan.deferredReviews > 0 && (
              <p className="-mt-3 text-[14px] text-sage-200">
                {plural(plan.deferredReviews, "opakování", "opakování", "opakování")} se dnes nevejde, přijde zítra.
              </p>
            )}
          </>
        )}
      </section>

      <Link href="/pokrok" className="group flex flex-col gap-3">
        <span className="flex items-baseline justify-between gap-4 text-[15.5px]">
          <span className="text-muted">
            Probráno {seen} z {core.length} poznatků
          </span>
          <span className="font-semibold text-sage-600 group-hover:underline">Pokrok</span>
        </span>
        <StatusBar counts={counts} />
      </Link>

      {(pending > 0 || syncError) && (
        <p className="text-[13.5px] text-faint">{syncError ? "Jsi offline. Odpovědi se uloží, až bude spojení." : "Ukládám…"}</p>
      )}
    </div>
  );
}
