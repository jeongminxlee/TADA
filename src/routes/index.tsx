import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  MOOD_LABELS,
  TASKS,
  MED_TASK,
  adaptiveTask,
  loadCheckIns,
  todayISO,
  useCheckIns,
  useOnboardingResult,
} from "@/lib/adhd-shared";
import { suggestNudge } from "@/lib/nudge.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Steady — Home" },
      { name: "description", content: "Today at a glance: your mood, adaptive next step, and AI nudge." },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const stored = useOnboardingResult();
  const [history] = useCheckIns();
  const today = history.find((c) => c.date === todayISO()) ?? null;

  // Streak: consecutive days ending today with a check-in.
  const streak = useMemo(() => {
    const set = new Set(history.map((c) => c.date));
    let n = 0;
    const d = new Date();
    while (set.has(d.toISOString().slice(0, 10))) {
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [history]);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up?" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const subtype = stored?.result.subtype ?? "Take the screener";
  const planKey = stored?.result.key ?? "below";
  const adaptive = adaptiveTask(today);
  const nextTask = adaptive?.task ?? TASKS[planKey].tasks[0];

  return (
    <AppShell
      title={greeting}
      subtitle={dateLabel}
      right={
        <Link
          to="/onboarding"
          className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
        >
          {streak > 0 ? `${streak}d streak` : "Start"}
        </Link>
      }
    >
      <div className="space-y-4">
        {stored && (
          <Link
            to="/more"
            className="block rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              Your presentation
            </p>
            <p className="mt-1 text-sm font-semibold">{subtype}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap to read what this means and your NHS next steps.
            </p>
          </Link>
        )}

        <MoodSnapshot today={today} />

        <NextStepCard
          title={nextTask.title}
          why={nextTask.why}
          adapted={!!adaptive}
          reason={adaptive?.reason}
        />

        <QuickNudge subtype={subtype} hasCheckIn={!!today} planKey={planKey} />

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/tasks"
            className="rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Today's plan</p>
            <p className="mt-1 text-sm font-medium">Open tasks →</p>
          </Link>
          <Link
            to="/calendar"
            className="rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary">History</p>
            <p className="mt-1 text-sm font-medium">Calendar →</p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function MoodSnapshot({ today }: { today: { mood: number } | null }) {
  if (!today) {
    return (
      <Link
        to="/mood"
        className="block rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center transition active:scale-[0.99]"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Today's check-in
        </p>
        <p className="mt-1 text-base font-semibold">Log your mood</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The app adapts your next step from how you feel right now.
        </p>
      </Link>
    );
  }
  const emojis = ["😞", "🙁", "😐", "🙂", "😄"];
  return (
    <Link
      to="/mood"
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
    >
      <span className="text-3xl leading-none" aria-hidden>
        {emojis[today.mood - 1]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
          Today's mood
        </p>
        <p className="truncate text-sm font-semibold">{MOOD_LABELS[today.mood - 1]}</p>
      </div>
      <span className="text-xs text-muted-foreground">Edit →</span>
    </Link>
  );
}

function NextStepCard({
  title,
  why,
  adapted,
  reason,
}: {
  title: string;
  why: string;
  adapted: boolean;
  reason?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
          Next small step
        </p>
        {adapted && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            Adapted
          </span>
        )}
      </div>
      {adapted && reason && (
        <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
      )}
      <p className="mt-2 text-base font-semibold leading-snug">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{why}</p>
      <Link
        to="/tasks"
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground transition active:opacity-90"
      >
        Open today's plan
      </Link>
    </div>
  );
}

type Nudge = {
  task: string;
  firstStepBullets: string[];
  timeEstimate: string;
  encouragement: string;
};

function QuickNudge({
  subtype,
  hasCheckIn,
  planKey,
}: {
  subtype: string;
  hasCheckIn: boolean;
  planKey: keyof typeof TASKS;
}) {
  const ask = useServerFn(suggestNudge);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("adhd-home-nudge");
      if (raw) setNudge(JSON.parse(raw));
    } catch {/* ignore */}
  }, []);

  async function go() {
    setLoading(true);
    setErr(null);
    try {
      let userTasks: string[] = [];
      try {
        const raw = JSON.parse(localStorage.getItem("adhd-nudge-tasks-v1") || "[]");
        if (Array.isArray(raw)) userTasks = raw.filter((t) => typeof t === "string" && t.trim());
      } catch { /* ignore */ }
      const planTitles = (TASKS[planKey]?.tasks ?? []).map((t) => t.title);
      const today = loadCheckIns().find((c) => c.date === todayISO()) ?? null;
      const adaptive = adaptiveTask(today);
      const adaptiveTitle = adaptive ? [adaptive.task.title] : [];
      const merged = Array.from(
        new Set([...userTasks, ...adaptiveTitle, ...planTitles].map((s) => s.trim()).filter(Boolean)),
      ).slice(0, 12);
      if (merged.length === 0) {
        setErr("No tasks available yet — finish the screener first.");
        setLoading(false);
        return;
      }
      const result = await ask({
        data: {
          mood: today?.mood ?? null,
          focus: today?.focus ?? null,
          energy: today?.energy ?? null,
          subtype,
          tasks: merged,
        },
      });
      setNudge(result as Nudge);
      localStorage.setItem("adhd-home-nudge", JSON.stringify(result));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setErr(
        msg.includes("402")
          ? "AI credits ran out."
          : msg.includes("429")
            ? "Lots of requests right now — try again in a moment."
            : "Couldn't get a nudge. Try again?",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
        AI nudge
      </p>
      <p className="mt-1 text-sm font-semibold">What's the next small thing?</p>
      {!hasCheckIn && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tip: log your mood first — the nudge adapts to it.
        </p>
      )}
      {nudge && (
        <div className="mt-3 space-y-2 rounded-xl bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Try this</p>
            {nudge.timeEstimate && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                ⏱ {nudge.timeEstimate}
              </span>
            )}
          </div>
          <p className="font-medium leading-snug">{nudge.task}</p>
          {nudge.firstStepBullets?.length > 0 && (
            <ul className="space-y-1 text-xs leading-relaxed text-foreground/90">
              {nudge.firstStepBullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="pt-1 text-xs italic text-foreground/80">{nudge.encouragement}</p>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground transition active:opacity-90 disabled:opacity-60"
      >
        {loading ? "Thinking…" : nudge ? "Get another nudge" : "Suggest my next step"}
      </button>
    </div>
  );
}