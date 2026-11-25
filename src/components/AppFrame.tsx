"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStudy } from "@/client/store";
import { daysUntilExam } from "@/engine/time";
import { czDayWithWeekday, plural } from "@/lib/format";
import { Button, Spinner } from "./ui";

const tabs = [
  { href: "/", label: "Dnes", icon: SunIcon },
  { href: "/temata", label: "Témata", icon: BookIcon },
  { href: "/pokrok", label: "Pokrok", icon: ChartIcon },
];

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/temata" && pathname.startsWith("/priprava"));

/** "za 11 dní" / "zítra" / "dnes" */
export function examCountdown(now: Date, examDate: string): string {
  const d = daysUntilExam(now, examDate);
  return d <= 0 ? "dnes" : d === 1 ? "zítra" : `za ${plural(d, "den", "dny", "dní")}`;
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, error, reload, learner } = useStudy();
  const [now] = useState(() => new Date());
  const focusMode = pathname.startsWith("/studium");

  let body: ReactNode = children;
  if (status === "loading") body = <Spinner />;
  if (status === "error")
    body = (
      <div className="max-w-md py-16">
        <p className="font-semibold">Nepodařilo se načíst data.</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Button className="mt-6" onClick={reload}>
          Zkusit znovu
        </Button>
      </div>
    );

  if (focusMode) return <div className="min-h-dvh">{body}</div>;

  return (
    <div className="min-h-dvh pb-24 lg:pb-0 lg:pl-60">
      <nav aria-label="Hlavní navigace" className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-8 border-r border-line px-5 pt-8 pb-7 lg:flex">
        <span className="px-3 font-serif text-[25px] font-semibold text-sage-700">Nutri</span>
        <ul className="flex flex-col gap-1">
          {tabs.map((t) => {
            const active = isActive(t.href, pathname);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15.5px] ${active ? "bg-sage-50 font-semibold text-sage-700" : "text-muted hover:bg-ink/[0.04] hover:text-ink"}`}
                >
                  <t.icon />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-4 px-3">
          {/* Dnes shows the countdown itself (exam timeline) — once is enough there. */}
          {pathname !== "/" && (
            <div>
              <p className="text-[13.5px] text-faint">Zkouška {czDayWithWeekday(learner.examDate)}</p>
              <p className="text-[20px] font-semibold text-sage-700">{examCountdown(now, learner.examDate)}</p>
            </div>
          )}
          <Link href="/nastaveni" className={`text-[14px] ${pathname === "/nastaveni" ? "font-semibold text-ink" : "text-faint hover:text-ink"}`}>
            Nastavení
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-xl px-5 pt-8 lg:max-w-5xl lg:px-16 lg:pt-14">{body}</main>

      <nav
        aria-label="Hlavní navigace"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {tabs.map((t) => {
            const active = isActive(t.href, pathname);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[12px] font-medium ${active ? "text-sage-700" : "text-faint hover:text-muted"}`}
                >
                  <t.icon />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M5 20v-8M12 20V5M19 20v-9" />
    </svg>
  );
}
