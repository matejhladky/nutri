"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStudy } from "@/client/store";
import { Button, Spinner } from "./ui";

const tabs = [
  { href: "/", label: "Dnes", icon: SunIcon },
  { href: "/temata", label: "Témata", icon: BookIcon },
  { href: "/pokrok", label: "Pokrok", icon: ChartIcon },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, error, reload } = useStudy();
  const focusMode = pathname.startsWith("/studium");

  let body: ReactNode = children;
  if (status === "loading") body = <Spinner />;
  if (status === "error")
    body = (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="font-medium">Nepodařilo se načíst data.</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Button className="mt-6" onClick={reload}>
          Zkusit znovu
        </Button>
      </div>
    );

  if (focusMode) return <div className="min-h-dvh">{body}</div>;

  return (
    <div className="min-h-dvh pb-24">
      <main className="mx-auto w-full max-w-xl px-5 pt-8">{body}</main>
      <nav
        aria-label="Hlavní navigace"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-xl">
          {tabs.map((t) => {
            const active =
              t.href === "/" ? pathname === "/" : pathname.startsWith(t.href) || (t.href === "/temata" && pathname.startsWith("/priprava"));
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${active ? "text-sage-700" : "text-faint hover:text-muted"}`}
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" />
      <path d="M8 7h7" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
    </svg>
  );
}
