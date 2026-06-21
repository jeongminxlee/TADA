import type { ReactNode } from "react";
import { Leaf } from "./leaf";
import type { ReactNode } from "react";

export function AppShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-[100dvh] bg-background text-foreground">
      {/* Ambient leaf flourishes — a calm, garden-like backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <Leaf className="absolute -left-10 top-24 h-40 w-40 -rotate-[28deg] text-primary/[0.05]" />
        <Leaf className="absolute -right-12 top-1/3 h-52 w-52 rotate-[140deg] text-accent/[0.06]" />
        <Leaf className="absolute -left-8 bottom-40 h-36 w-36 rotate-[200deg] text-primary/[0.04]" />
      </div>

      <header
        className="sticky top-0 z-30 overflow-hidden border-b border-border bg-background/85 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Leaf
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-2 h-20 w-20 rotate-[160deg] text-primary/10"
        />
        <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-lg font-semibold tracking-tight">
              <span className="inline-flex h-5 w-5 items-center justify-center text-primary">
                <Leaf className="h-5 w-5 -rotate-12" />
              </span>
              {title}
            </h1>
            {subtitle && (
              <p className="truncate pl-7 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      </header>
      <div className="relative z-10 mx-auto max-w-md px-5 pb-28 pt-4">{children}</div>
    </main>
  );
}