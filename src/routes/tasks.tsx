import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  TASKS,
  MED_TASK,
  adaptiveTask,
  todayISO,
  useCheckIns,
  useOnboardingResult,
  NudgeCard,
  type Task,
} from "@/lib/adhd-shared";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Steady — Tasks" },
      { name: "description", content: "Your adaptive ADHD daily plan plus your own to-dos with an AI coach." },
    ],
  }),
  component: TasksRoute,
});

function TasksRoute() {
  const stored = useOnboardingResult();
  const [history] = useCheckIns();
  const today = history.find((c) => c.date === todayISO()) ?? null;

  if (!stored) {
    return (
      <AppShell title="Tasks">
        <EmptyOnboarding />
      </AppShell>
    );
  }

  const planKey = stored.result.key;
  const meds = stored.onboarding.meds;
  const basePlan = TASKS[planKey];
  const medTask = MED_TASK[meds];
  const adaptive = adaptiveTask(today);
  const planTasks: Task[] = [
    ...(adaptive ? [adaptive.task] : []),
    ...basePlan.tasks,
    ...(medTask ? [medTask] : []),
  ];

  const adaptiveFp = adaptive ? adaptive.task.title.slice(0, 24) : "none";
  const storageKey = `adhd-tasks-${planKey}-${meds}-${adaptiveFp}-${todayISO()}`;
  const [done, setDone] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(done));
  }, [done, storageKey]);
  const completed = Object.values(done).filter(Boolean).length;

  return (
    <AppShell
      title="Tasks"
      subtitle={`${completed}/${planTasks.length} done today`}
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                Today's plan
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold">{basePlan.headline}</p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
              {completed}/{planTasks.length}
            </span>
          </div>

          {adaptive ? (
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-primary">
                Adapting to today's check-in
              </p>
              <p className="mt-0.5 text-xs leading-relaxed">{adaptive.reason}</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link to="/mood" className="underline">Log today's mood</Link> and the plan adapts to how you feel.
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {planTasks.map((t, i) => {
              const checked = !!done[i];
              const isAdaptive = !!adaptive && i === 0;
              const isMed = !!medTask && i === planTasks.length - 1;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                    className={
                      "group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition " +
                      (checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-background active:bg-accent/30")
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border " +
                        (checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-transparent")
                      }
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1">
                        {isAdaptive && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                            Adapted
                          </span>
                        )}
                        {isMed && (
                          <span className="rounded-full bg-accent/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent-foreground">
                            Medication
                          </span>
                        )}
                      </span>
                      <span
                        className={
                          "mt-0.5 block text-sm font-medium leading-snug " +
                          (checked ? "text-muted-foreground line-through" : "text-foreground")
                        }
                      >
                        {t.title}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        {t.why}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <NudgeCard subtype={stored.result.subtype} />
      </div>
    </AppShell>
  );
}

function EmptyOnboarding() {
  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center">
      <p className="text-sm font-semibold">Finish the screener first</p>
      <p className="mt-1 text-xs text-muted-foreground">
        We tailor the plan to your subtype, age, and medication status.
      </p>
      <Link
        to="/onboarding"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Start the screener
      </Link>
    </div>
  );
}