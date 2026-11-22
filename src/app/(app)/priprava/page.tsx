"use client";
/**
 * "Co trénovat naživo": what the app cannot train (hands-on measuring, role-play, paper calculations, exam logistics).
 * Ticks are a per-device convenience (localStorage), not learner data.
 */
import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/ui";

type Item = { id: string; title: string; detail: string };
type Group = { title: string; why: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Praktická část – simulovaný klient",
    why: "U praktické zkoušky pracuješ s klientem: rozhovor, měření, výpočty, plán. To se nejlíp nacvičí nahlas s někým.",
    items: [
      {
        id: "rozhovor",
        title: "Vstupní rozhovor s kamarádkou v roli klientky",
        detail: "Úvod, dotazník, zdravotní stav, stravovací zvyklosti, cíl a motivace. Na konci shrň, co jsi zjistila, a vyplň kartu klienta.",
      },
      {
        id: "mereni",
        title: "Měření metrem: pas, boky, výpočet WHR a BMI",
        detail: "Změř se navzájem na správných místech, spočítej WHR a BMI a řekni nahlas, co výsledek znamená a co neznamená.",
      },
      {
        id: "bia",
        title: "Bioimpedance (pokud máš k přístroji přístup)",
        detail: "Vyzkoušej měření za standardních podmínek a nahlas vysvětli, co ovlivňuje výsledek (hydratace, jídlo, sport) a kdy se nepoužívá.",
      },
      {
        id: "vypocty",
        title: "Celý výpočet na papíře s kalkulačkou",
        detail: "BMR dvěma metodami → NEAT, EAT, TEF → TDEE → cílový příjem → makroživiny v gramech. Pak vysvětli, proč se metody liší a kterou zvolíš.",
      },
      {
        id: "jidelnicek",
        title: "Jídelníček na jeden den na papíře",
        detail: "Podle vypočtených makroživin rozlož energii do jídel a navrhni konkrétní jídla. Zdůvodni výběr (cíl, režim dne, chutě klientky).",
      },
      {
        id: "narocni",
        title: "Role-play náročných klientů",
        detail: "Ať tě kamarádka zkusí: ostýchavá, agresivní, přecitlivělá klientka. Trénuj klidný tón, otázky a hranice.",
      },
      {
        id: "red-flags",
        title: "Odeslání k lékaři nahlas",
        detail: "Na vymyšleném případu řekni, které příznaky patří lékaři nebo psychologovi a jak to klientovi citlivě sdělíš.",
      },
    ],
  },
  {
    title: "Ústní část",
    why: "V aplikaci odpovídáš nahlas u otázek „Vysvětli“. Pomůže i nahrát se a poslechnout si, jestli mluvíš jasně a v souvislostech.",
    items: [
      {
        id: "nahravka",
        title: "Nahraj si odpověď na 2–3 ústní témata",
        detail: "Např. výživa v těhotenství, sportovní výživa, alternativní směry. Poslechni si: je tam definice, příklady, rizika a doporučení?",
      },
    ],
  },
  {
    title: "Organizace zkoušky",
    why: "Tohle aplikace neví – ověř si to u autorizované osoby, u které zkoušku skládáš.",
    items: [
      {
        id: "organizace",
        title: "Zjisti, co si přinést a jak zkouška probíhá",
        detail: "Například zda smíš mít vlastní kalkulačku, jestli se měří na přístroji, kolik času je na praktickou část a v jakém pořadí jdou části.",
      },
    ],
  },
];

const KEY = "nutri.priprava.v1";

function loadTicks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export default function PracticePage() {
  const [ticks, setTicks] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadTicks()));
  const toggle = (id: string) => {
    const next = ticks.includes(id) ? ticks.filter((t) => t !== id) : [...ticks, id];
    setTicks(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: ticks just won't persist */
    }
  };
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-5 animate-rise">
      <Link href="/temata" className="self-start text-sm text-muted hover:text-ink">
        ← Témata
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Co trénovat naživo</h1>
        <p className="mt-1 text-muted">
          Věci, které aplikace nenacvičí za tebe. Stačí projít jednou nebo dvakrát před zkouškou ({ticks.length} z {total}).
        </p>
      </header>
      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <p className="text-[15px] text-muted">{g.why}</p>
          </div>
          <Panel className="divide-y divide-line">
            {g.items.map((it) => {
              const on = ticks.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(it.id)}
                  className="flex w-full items-start gap-3 px-5 py-4 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-sage-600 bg-sage-600 text-white" : "border-line-strong"}`}
                    aria-hidden
                  >
                    {on && <span className="text-[11px]">✓</span>}
                  </span>
                  <span className="flex-1">
                    <span className={`block font-medium ${on ? "text-muted line-through decoration-line-strong" : ""}`}>{it.title}</span>
                    <span className="mt-0.5 block text-[15px] text-muted">{it.detail}</span>
                  </span>
                </button>
              );
            })}
          </Panel>
        </section>
      ))}
    </div>
  );
}
