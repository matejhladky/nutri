import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-sage-600 text-white hover:bg-sage-700 active:bg-sage-700 shadow-sm",
  secondary: "bg-card text-ink border border-line-strong hover:bg-paper active:bg-paper",
  ghost: "text-muted hover:text-ink hover:bg-black/[0.03]",
};
const sizes = { md: "min-h-12 px-5 text-base", lg: "min-h-14 px-6 text-lg", sm: "min-h-9 px-3 text-sm" };

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
    <kbd aria-hidden className="hidden md:inline-flex min-w-5 h-5 items-center justify-center rounded-md border border-current/25 px-1 text-[11px] font-normal opacity-60">
      {children}
    </kbd>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-card border border-line shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-medium uppercase tracking-wide text-faint">{children}</div>;
}

export function Spinner({ label = "Načítám…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sage-500 border-t-transparent" />
      {label}
    </div>
  );
}
