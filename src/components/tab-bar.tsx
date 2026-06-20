import { Link, useRouterState } from "@tanstack/react-router";

type Tab = {
  to: "/" | "/tasks" | "/calendar" | "/mood" | "/more";
  label: string;
  icon: string;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/tasks", label: "Tasks", icon: "✓" },
  { to: "/calendar", label: "Calendar", icon: "📅" },
  { to: "/mood", label: "Mood", icon: "◐" },
  { to: "/more", label: "More", icon: "⋯" },
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
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition " +
                  (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
                }
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden className="text-lg leading-none">
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}