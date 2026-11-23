import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition-colors select-none disabled:opacity-45 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-sage-600 text-white hover:bg-sage-700 active:bg-sage-700",
  secondary: "bg-card text-ink border border-line-strong hover:border-faint",
  ghost: "font-medium text-muted hover:text-ink hover:bg-ink/[0.04]",
};
const sizes = { md: "min-h-12 px-5 text-base", lg: "min-h-[52px] px-6 text-[17px]", sm: "min-h-9 px-3 text-sm" };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  kbd,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  /** Keyboard shortcut hint, shown on wide screens. */
  kbd?: string;
}) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      aria-hidden
      className="hidden min-w-5 h-5 items-center justify-center rounded-md border border-current/30 px-1.5 font-sans text-[11.5px] font-medium opacity-70 md:inline-flex"
    >
      {children}
    </kbd>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card ${className}`}>{children}</div>;
}

/** Small topic line above a card, with an optional badge ("Nové"). */
export function CardMeta({ badge, children }: { badge?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[14px] text-muted">
      {badge && <span className="rounded-full bg-sage-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-sage-600">{badge}</span>}
      <span className="truncate">{children}</span>
    </div>
  );
}

export function Spinner({ label = "Načítám…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sage-500 border-t-transparent" />
      {label}
    </div>
  );
}

/**
 * The actions of a study card. On a phone a bar pinned to the bottom (thumb reach), on wider screens a row at the end
 * of the card, aligned right.
 */
export function ActionBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-line bg-paper/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:z-auto md:mt-2 md:justify-end md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${className}`}
    >
      {children}
    </div>
  );
}

export function Icon({ name, size = 20 }: { name: "close" | "check" | "back" | "chevron" | "settings"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "close") return <svg {...common} strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>;
  if (name === "check") return <svg {...common} strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (name === "back") return <svg {...common} strokeWidth="2"><path d="M15 5l-7 7 7 7" /></svg>;
  if (name === "chevron") return <svg {...common} strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>;
  return (
    <svg {...common} strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
