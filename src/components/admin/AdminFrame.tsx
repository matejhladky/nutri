"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AdminFrame({ learners, children }: { learners: { id: string; label: string }[]; children: ReactNode }) {
  const pathname = usePathname();
  const tabs = [...learners.map((l) => ({ href: `/admin/${l.id}`, label: l.label })), { href: "/admin/obsah", label: "Obsah" }];
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/admin/obsah" && pathname.startsWith("/admin/nahled"));
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 px-5 lg:flex-nowrap lg:px-10">
          <Link href="/admin" className="mr-auto shrink-0 py-3 font-serif text-[22px] font-semibold text-sage-700 lg:mr-0 lg:py-4">
            Nutri <span className="font-sans text-[14px] font-normal text-faint">správa</span>
          </Link>
          {/* Phones: tabs on their own row under the wordmark. */}
          <nav aria-label="Správa" className="-mx-3 -mb-px order-last flex w-full min-w-0 gap-1 overflow-x-auto lg:order-none lg:mx-0 lg:w-auto lg:flex-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active(t.href) ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-3 text-[15px] lg:py-4 ${active(t.href) ? "border-sage-600 font-semibold text-sage-700" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="shrink-0 text-[14px] text-faint hover:text-ink"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.replace("/admin/login");
            }}
          >
            Odhlásit
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 pt-8 pb-20 lg:px-10 lg:pt-12">{children}</main>
    </div>
  );
}
