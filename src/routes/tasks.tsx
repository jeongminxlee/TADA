import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePoints } from "@/lib/points";
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
import {
  type ScheduledTask,
  estimateDurationMin,
  nextFreeStartMin,
  defaultStartMin,
  fmtTime,
  fmtDuration,
  customTasksKey,
} from "@/lib/task-schedule";

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
  // "Today's plan" shows only actual, actionable tasks (not strategy tips).
  // Strategy tips for the subtype now live on the Content tab.
  const planTasks: Task[] = [
    ...(adaptive ? [adaptive.task] : []),
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

  // Custom user-added to-dos (with optional voice input + auto-scheduling)
  const customKey = customTasksKey(todayISO());
  const [custom, setCustom] = useState<ScheduledTask[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(customKey) || "[]"); } catch { return []; }
  });

  // Re-read storage when tab regains focus (chat on Home writes here too).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => {
      try {
        const raw = localStorage.getItem(customKey) || "[]";
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustom(parsed);
      } catch { /* ignore */ }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === customKey) reload(); };
    window.addEventListener("focus", reload);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("storage", onStorage);
    };
  }, [customKey]);

  // Auto-schedule any custom task that doesn't have a time yet.
  useEffect(() => {
    const needs = custom.some((t) => typeof t.startMin !== "number" || typeof t.durationMin !== "number");
    if (!needs) return;
    setCustom((list) => {
      const next: ScheduledTask[] = [];
      for (const t of list) {
        if (typeof t.startMin === "number" && typeof t.durationMin === "number") {
          next.push(t);
          continue;
        }
        const durationMin = t.durationMin ?? estimateDurationMin(t.title);
        const startMin = nextFreeStartMin(next, defaultStartMin(), durationMin);
        next.push({ ...t, startMin, durationMin });
      }
      return next;
    });
  }, [custom]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(customKey, JSON.stringify(custom));
  }, [custom, customKey]);

  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  // Points & rewards
  const { award } = usePoints();
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
    setCustom((c) => {
      const durationMin = estimateDurationMin(t);
      const startMin = nextFreeStartMin(c, defaultStartMin(), durationMin);
      return [...c, { id: Date.now() + Math.random(), title: t, done: false, startMin, durationMin }];
    });
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

          <p className="mt-3 text-[11px] text-muted-foreground">
            Tip: ask TADA on the <Link to="/" className="underline">home tab</Link> — "add task email Sam" — and it lands on today's plan automatically.
          </p>
        </section>

        <DayCalendar tasks={custom} onToggle={toggleCustomTask} />

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

          {planTasks.length > 0 && (
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
          )}

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your to-dos
          </p>
          {custom.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing scheduled yet — add one above and it'll be time-blocked for you.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {custom
                .slice()
                .sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0))
                .map((item) => (
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
                      <span className="min-w-0 flex-1">
                        <span
                          className={
                            "block text-sm font-medium leading-snug " +
                            (item.done ? "text-muted-foreground line-through" : "text-foreground")
                          }
                        >
                          {item.title}
                        </span>
                        {typeof item.startMin === "number" && typeof item.durationMin === "number" && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {fmtTime(item.startMin)} – {fmtTime(item.startMin + item.durationMin)} · {fmtDuration(item.durationMin)}
                          </span>
                        )}
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
      </div>
    </AppShell>
  );
}

// Day timeline: 12am → 12am next day, with scheduled to-dos as blocks.
const HOUR_PX = 48;

function DayCalendar({
  tasks,
  onToggle,
}: {
  tasks: ScheduledTask[];
  onToggle: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  // Scroll to ~1 hour before "now" on mount so the user sees current time.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = Math.max(0, (nowMin / 60 - 1) * HOUR_PX);
    el.scrollTop = target;
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduled = useMemo(
    () =>
      tasks.filter(
        (t) => typeof t.startMin === "number" && typeof t.durationMin === "number",
      ),
    [tasks],
  );

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Your day</p>
          <p className="mt-0.5 text-sm font-semibold">12am → 12am</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
          {scheduled.length} scheduled
        </span>
      </div>

      <div
        ref={scrollRef}
        className="mt-3 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-background"
      >
        <div className="relative" style={{ height: HOUR_PX * 24 }}>
          {/* Hour grid */}
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex"
              style={{ top: h * HOUR_PX, height: HOUR_PX }}
            >
              <div className="w-14 shrink-0 border-r border-border/60 pr-2 pt-1 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                {fmtTime(h * 60)}
              </div>
              <div className="flex-1 border-b border-border/40" />
            </div>
          ))}

          {/* Now line */}
          {nowMin >= 0 && nowMin < 24 * 60 && (
            <div
              className="pointer-events-none absolute left-14 right-2 z-10 flex items-center gap-1"
              style={{ top: (nowMin / 60) * HOUR_PX }}
            >
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="h-px flex-1 bg-destructive" />
            </div>
          )}

          {/* Task blocks */}
          {scheduled.map((t) => {
            const start = t.startMin as number;
            const dur = t.durationMin as number;
            const top = (start / 60) * HOUR_PX;
            const height = Math.max(22, (dur / 60) * HOUR_PX - 2);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggle(t.id)}
                className={
                  "absolute left-[60px] right-2 z-20 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition " +
                  (t.done
                    ? "border-primary/40 bg-primary/10 text-muted-foreground line-through"
                    : "border-primary/50 bg-primary text-primary-foreground hover:opacity-95")
                }
                style={{ top, height }}
                title={`${t.title} · ${fmtTime(start)}–${fmtTime(start + dur)}`}
              >
                <div className="truncate font-semibold">{t.title}</div>
                <div className="truncate text-[10px] opacity-90">
                  {fmtTime(start)} – {fmtTime(start + dur)} · {fmtDuration(dur)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {scheduled.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Add a to-do above and it lands on your calendar with an estimated time.
        </p>
      )}
    </section>
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
