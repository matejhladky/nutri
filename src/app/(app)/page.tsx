"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useStudy } from "@/client/store";
import { dailyPlan } from "@/engine/planner";
import { pointStatus } from "@/engine/state";
import { recentDays } from "@/components/Activity";
import { Icon } from "@/components/ui";
import { ExamPath, KnowledgeMap } from "@/components/TodayVisuals";
import { buddyLine, type BuddyTone } from "@/lib/buddy";
import { NewsCard } from "@/components/NewsCard";
import { NEWS, pendingNews } from "@/lib/news";
import { plural } from "@/lib/format";
import { pickQuote } from "@/lib/quotes";

const noSubscribe = () => () => {};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });

/** Circle behind the emoji: honey when she leads, green when you do, outlined when level. */
const TONE: Record<BuddyTone, string> = {
  behind: "bg-amber-50",
  ahead: "bg-sage-100",
  both: "bg-sage-100",
  even: "border-[1.5px] border-line-strong",
};

export default function TodayPage() {
  const router = useRouter();
  const { learner, states, settings, saveSettings, points, todayCards, answersByDay, extraToday, buddy, pending, syncError, retrievability, timing } = useStudy();
  // Newest notice she hasn't dismissed (and announced after she started); hidden at once on dismiss, saved to settings.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const since = useMemo(() => {
    let first: string | null = null;
    for (const st of states.values()) if (st.introducedAt && (!first || st.introducedAt < first)) first = st.introducedAt;
    return first;
  }, [states]);
  const news = pendingNews(NEWS, [...(settings.seenNews ?? []), ...dismissed], since);
  const dismissNews = () => {
    if (!news) return;
    setDismissed((d) => [...d, news.id]);
    void saveSettings({ seenNews: [...(settings.seenNews ?? []), news.id] }).catch(() => {});
  };
  const now = useMemo(() => new Date(), []);
  // Random per app load; null on the server so a server render can never mismatch the client.
  const quote = useSyncExternalStore(noSubscribe, pickQuote, () => null);

  const plan = useMemo(
    () => dailyPlan({ now, examDate: learner.examDate, points, states, dailyMinutes: settings.dailyMinutes, retrievability, timing }),
    [now, learner.examDate, settings, points, states, retrievability, timing],
  );
  const core = points.filter((p) => p.tier !== "C");
  const seen = core.filter((p) => pointStatus(states.get(p.id), p) !== "new").length;

  const reviews = plan.dueReviews + plan.learningDue;
  const newLeft = Math.max(0, plan.newTarget - plan.newToday);
  const started = todayCards > 0;
  const finalDays = plan.daysLeft !== null && plan.daysLeft <= 2;
  const sweepOnly = finalDays || plan.remainingNew === 0;
  const examDay = plan.daysLeft !== null && plan.daysLeft <= 0;
  const minutes = Math.max(5, plan.estimatedMinutes);

  // The card speaks in time and questions — what they experience — not in the planner's terms.
  const newPoints = newLeft > 0 ? plural(newLeft, "nový poznatek", "nové poznatky", "nových poznatků") : null;
  const contents = reviews > 0 ? (newPoints ? `Opakování a ${newPoints}.` : "Dnes jen opakování.") : newPoints ? `${newPoints.charAt(0).toUpperCase()}${newPoints.slice(1)}.` : "Pár krátkých otázek.";
  const heading = plan.goalReached
    ? plan.laterToday > 0
      ? "Zatím hotovo"
      : "Pro dnešek hotovo"
    : started
      ? `Ještě asi ${minutes} minut`
      : `Asi ${minutes} minut`;
  // Share of today's plan done, in planned minutes (an estimate — shown as a bar, never as a number).
  const progress = plan.goalReached ? 1 : Math.min(0.97, plan.doneMinutes / Math.max(1, plan.doneMinutes + plan.estimatedMinutes));

  const line = buddy
    ? buddyLine(
        { answers: todayCards, extra: extraToday, planDone: plan.goalReached, days7: recentDays(answersByDay, now, 7).filter((d) => d.answers > 0).length },
        buddy,
        now,
      )
    : null;

  const answered = started ? (
    <>
      Máš za sebou <strong className="font-semibold text-cream tabular-nums">{plural(todayCards, "otázku", "otázky", "otázek")}</strong>.
    </>
  ) : null;
  const doneNote =
    plan.laterToday > 0 && plan.nextLaterAt
      ? `Kolem ${clock(plan.nextLaterAt)} jich tu ještě pár přibude.`
      : finalDays
        ? "Před zkouškou už jen opakuješ."
        : null;

  return (
    <div className="flex flex-col animate-rise">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-tight lg:text-[26px]">{learner.name ? `Ahoj ${learner.name} ☀️` : "Ahoj ☀️"}</h1>
          {quote && <p className="max-w-xl font-serif text-[14px] leading-snug text-muted italic lg:text-[15px]">„{quote}“</p>}
          {examDay && <p className="mt-2 text-muted">Dnes je zkouška. Hodně štěstí!</p>}
        </div>
        <Link href="/nastaveni" aria-label="Nastavení" className="-mr-2 rounded-xl p-2 text-faint hover:text-ink lg:hidden">
          <Icon name="settings" size={22} />
        </Link>
      </header>

      {news && <NewsCard item={news} onDismiss={dismissNews} />}

      <section
        aria-labelledby="plan"
        className="mt-6 flex flex-col gap-[18px] rounded-[18px] bg-sage-700 p-[22px] text-cream lg:mt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end lg:gap-10 lg:rounded-[20px] lg:px-9 lg:py-8"
      >
        <div className="flex flex-col gap-[18px] lg:gap-[22px]">
          <div className="flex flex-col gap-2 lg:gap-2.5">
            <span id="plan" className="text-[13.5px] font-semibold text-sage-200">
              Plán na dnešek
            </span>
            <h2 className="max-w-[520px] font-serif text-[26px] leading-[1.22] font-medium [text-wrap:balance] lg:text-[34px] lg:leading-[1.18]">{heading}</h2>
          </div>
          <div className="flex flex-col gap-2.5 lg:max-w-[460px]">
            {(started || plan.goalReached) && (
              <div
                role="progressbar"
                aria-label="Dnešní plán"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className="h-1.5 overflow-hidden rounded-full bg-cream/15"
              >
                <div className="h-full rounded-full bg-sage-200" style={{ width: `${Math.max(3, progress * 100)}%` }} />
              </div>
            )}
            {(started || !plan.goalReached || doneNote) && (
              <p className="text-[14px] text-sage-200 lg:text-[14.5px]">
                {plan.goalReached ? (
                  <>
                    {answered} {doneNote}
                  </>
                ) : started ? (
                  answered
                ) : (
                  contents
                )}
              </p>
            )}
          </div>
        </div>
        {plan.goalReached ? (
          (plan.remainingNew > 0 || seen > 0) && (
            <button
              type="button"
              onClick={() => router.push("/studium?navic=1")}
              className="min-h-14 rounded-2xl border border-cream/40 px-5 py-3 text-[16px] font-semibold leading-snug hover:bg-cream/10 lg:min-h-[60px]"
            >
              {sweepOnly ? "Procvičit nejslabší místa" : "Pokračovat dál"}
            </button>
          )
        ) : (
          <button
            type="button"
            autoFocus
            onClick={() => router.push("/studium")}
            className="h-14 rounded-[14px] bg-cream text-[18px] font-bold text-sage-700 hover:bg-white lg:h-[60px] lg:rounded-2xl"
          >
            {started ? "Pokračovat" : "Začít"}
          </button>
        )}
      </section>

      {line && (
        <p data-testid="buddy" className="mt-3 flex items-center gap-2.5 px-0.5 text-[15px] leading-snug lg:mt-3.5 lg:px-1 lg:text-[15.5px]">
          <span aria-hidden className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[16px] leading-none ${TONE[line.tone]}`}>
            {line.emoji}
          </span>
          <span>
            <span className={line.tone === "both" ? "font-medium text-sage-700" : undefined}>{line.line1}</span>{" "}
            <span className="text-muted">{line.line2}</span>
          </span>
        </p>
      )}

      {!examDay && (
        <div className="mt-7 border-t border-line pt-4 lg:mt-9 lg:pt-5">
          <ExamPath answersByDay={answersByDay} examDate={learner.examDate} now={now} />
        </div>
      )}

      <section aria-labelledby="mapa" className="mt-[22px] flex flex-col gap-3 border-t border-line pt-4 lg:mt-7 lg:gap-3.5 lg:pt-5">
        <h2 id="mapa" className="text-[14.5px] font-normal lg:text-[15px]">
          <Link href="/pokrok" className="text-muted hover:text-ink">
            Probráno <strong className="font-semibold text-sage-700">{seen}</strong> z {core.length} poznatků <span className="text-sage-600">→</span>
          </Link>
        </h2>
        <KnowledgeMap points={points} states={states} now={now} />
      </section>

      {(pending > 0 || syncError) && (
        <p className="mt-6 text-[13.5px] text-faint">{syncError ? "Jsi offline. Odpovědi se uloží, až bude spojení." : "Ukládám…"}</p>
      )}
    </div>
  );
}
