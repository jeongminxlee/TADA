import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CheckCircle2, Calendar, Gauge, MoreHorizontal } from "lucide-react";
import { Leaf } from "./leaf";

type Tab = {
  to: "/" | "/tasks" | "/calendar" | "/mood" | "/more";
  label: string;
  icon: ReactNode;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: <Home size={20} strokeWidth={2.5} /> },
  { to: "/tasks", label: "Tasks", icon: <CheckCircle2 size={20} strokeWidth={2.5} /> },
  { to: "/calendar", label: "Calendar", icon: <Calendar size={20} strokeWidth={2.5} /> },
  { to: "/mood", label: "Mood", icon: <Gauge size={20} strokeWidth={2.5} /> },
  { to: "/more", label: "Content", icon: <MoreHorizontal size={20} strokeWidth={2.5} /> },
];

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Hide tab bar on the onboarding flow.
  if (pathname.startsWith("/onboarding")) return null;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map((t) => {
          const active =
            t.to === "/"
              ? pathname === "/"
              : pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                className={
                  "relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition " +
                  (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
                }
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <Leaf
                    aria-hidden
                    className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 -rotate-12 text-primary"
                  />
                )}
                <span aria-hidden>{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}