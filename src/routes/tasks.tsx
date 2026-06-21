import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
      { title: "TADA — Tasks" },
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

  // Custom user-added to-dos (with optional voice input)
  const customKey = `adhd-custom-tasks-${todayISO()}`;
  const [custom, setCustom] = useState<{ id: number; title: string; done: boolean }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(customKey) || "[]"); } catch { return []; }
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(customKey, JSON.stringify(custom));
  }, [custom, customKey]);

  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  // Points & rewards
  const { points, award } = usePoints();
  const PLAN_PTS = 10;
  const CUSTOM_PTS = 5;

  const togglePlanTask = (i: number) => {
    setDone((d) => {
      const next = { ...d, [i]: !d[i] };
      const delta = next[i] ? PLAN_PTS : -PLAN_PTS;
      award(delta, next[i] ? `+${PLAN_PTS} pts · nice work` : undefined);
      return next;
    });
  };

  const toggleCustomTask = (id: number) => {
    setCustom((c) =>
      c.map((x) => {
        if (x.id !== id) return x;
        const becomingDone = !x.done;
        award(becomingDone ? CUSTOM_PTS : -CUSTOM_PTS, becomingDone ? `+${CUSTOM_PTS} pts` : undefined);
        return { ...x, done: becomingDone };
      }),
    );
  };

  const addCustom = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setCustom((c) => [...c, { id: Date.now() + Math.random(), title: t, done: false }]);
    setDraft("");
  };

  const toggleVoice = () => {
    setVoiceError(null);
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR: any =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      setVoiceError("Voice input isn't supported in this browser. Try Chrome or Safari.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setDraft((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      setVoiceError(e?.error === "not-allowed" ? "Microphone permission denied." : "Couldn't capture voice. Try again.");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) addCustom(finalText);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setVoiceError("Couldn't start voice input.");
    }
  };

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
                    onClick={() => togglePlanTask(i)}
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

        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Your to-dos</p>
          <p className="mt-0.5 text-sm font-semibold">Add your own — type or speak</p>

          <form
            onSubmit={(e) => { e.preventDefault(); addCustom(draft); }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={listening ? "Listening…" : "e.g. Email Sam back"}
              className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={listening ? "Stop voice input" : "Add to-do by voice"}
              aria-pressed={listening}
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition " +
                (listening
                  ? "border-primary bg-primary text-primary-foreground animate-pulse"
                  : "border-border bg-background hover:bg-accent/30")
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {voiceError && (
            <p className="mt-2 text-[11px] text-destructive">{voiceError}</p>
          )}

          {custom.length > 0 && (
            <ul className="mt-4 space-y-2">
              {custom.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCustomTask(item.id)}
                    className={
                      "group flex flex-1 items-start gap-3 rounded-xl border p-3 text-left transition " +
                      (item.done
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-background active:bg-accent/30")
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border " +
                        (item.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-transparent")
                      }
                    >
                      ✓
                    </span>
                    <span
                      className={
                        "min-w-0 flex-1 text-sm font-medium leading-snug " +
                        (item.done ? "text-muted-foreground line-through" : "text-foreground")
                      }
                    >
                      {item.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustom((c) => c.filter((x) => x.id !== item.id))}
                    aria-label="Delete to-do"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <NudgeCard subtype={stored.result.subtype} />
        <RewardsCard points={points} />
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

const POINTS_KEY = "adhd-points-v1";
const CLAIMED_KEY = "adhd-rewards-claimed-v1";

const REWARDS: { threshold: number; label: string; emoji: string; blurb: string }[] = [
  { threshold: 50, label: "Sprout", emoji: "🌱", blurb: "Got started — that's the hardest part." },
  { threshold: 150, label: "Bloom", emoji: "🌿", blurb: "Building real momentum." },
  { threshold: 300, label: "Grove", emoji: "🌳", blurb: "Consistency is paying off." },
  { threshold: 600, label: "TADA Legend", emoji: "✨", blurb: "You're showing up for yourself." },
];

function usePoints() {
  const [points, setPoints] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(POINTS_KEY) || 0);
  });
  const [claimed, setClaimed] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(CLAIMED_KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(POINTS_KEY, String(points));
  }, [points]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(CLAIMED_KEY, JSON.stringify(claimed));
  }, [claimed]);

  const award = (delta: number, message?: string) => {
    setPoints((p) => {
      const next = Math.max(0, p + delta);
      if (delta > 0) {
        if (message) toast.success(message);
        const newly = REWARDS.find((r) => next >= r.threshold && p < r.threshold && !claimed.includes(r.threshold));
        if (newly) {
          setClaimed((c) => [...c, newly.threshold]);
          toast(`${newly.emoji} Reward unlocked: ${newly.label}`, { description: newly.blurb });
        }
      }
      return next;
    });
  };

  return { points, claimed, award };
}

function RewardsCard({ points }: { points: number }) {
  const next = REWARDS.find((r) => points < r.threshold);
  const prev = [...REWARDS].reverse().find((r) => points >= r.threshold);
  const floor = prev?.threshold ?? 0;
  const ceil = next?.threshold ?? points;
  const pct = next ? Math.round(((points - floor) / (ceil - floor)) * 100) : 100;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Rewards</p>
          <p className="mt-0.5 text-sm font-semibold">{points} pts</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
          {next ? `Next: ${next.emoji} ${next.label}` : "All unlocked"}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {next && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {ceil - points} pts to {next.label}
        </p>
      )}

      <ul className="mt-4 grid grid-cols-4 gap-2">
        {REWARDS.map((r) => {
          const unlocked = points >= r.threshold;
          return (
            <li
              key={r.threshold}
              className={
                "flex flex-col items-center rounded-xl border p-2 text-center transition " +
                (unlocked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-background opacity-60")
              }
              title={`${r.label} · ${r.threshold} pts`}
            >
              <span className={"text-xl " + (unlocked ? "" : "grayscale")}>{r.emoji}</span>
              <span className="mt-1 text-[10px] font-medium leading-tight">{r.label}</span>
              <span className="text-[9px] text-muted-foreground">{r.threshold}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Earn 10 pts per plan task and 5 pts per personal to-do.
      </p>
    </section>
  );
}