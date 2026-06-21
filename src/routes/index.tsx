import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { AppShell } from "@/components/app-shell";

import {
  TASKS,
  NudgeCard,
  loadCheckIns,
  todayISO,
  useOnboardingResult,
} from "@/lib/adhd-shared";
import { chatReply } from "@/lib/chat.functions";
import {
  parseAddTaskIntent,
  estimateDurationMin,
  nextFreeStartMin,
  defaultStartMin,
  fmtTime,
  fmtDuration,
  customTasksKey,
  type ScheduledTask,
} from "@/lib/task-schedule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TADA — Ask anything" },
      { name: "description", content: "Ask TADA, your non-diagnostic ADHD coach. Tips and pointers to the right in-app tool." },
    ],
  }),
  component: HomeRoute,
});

type Msg = { role: "user" | "assistant"; content: string };

function HomeRoute() {
  const stored = useOnboardingResult();
  const subtype = stored?.result.subtype ?? "Take the screener";
  const planKey = stored?.result.key ?? "below";

  const ask = useServerFn(chatReply);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function onSubmit(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    // Local intent: "add task ..." → land it on the Tasks calendar
    const taskTitle = parseAddTaskIntent(text);
    if (taskTitle) {
      try {
        const key = customTasksKey(new Date().toISOString().slice(0, 10));
        const existing: ScheduledTask[] = (() => {
          try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
        })();
        const durationMin = estimateDurationMin(taskTitle);
        const startMin = nextFreeStartMin(existing, defaultStartMin(), durationMin);
        const item: ScheduledTask = {
          id: Date.now() + Math.random(),
          title: taskTitle,
          done: false,
          startMin,
          durationMin,
        };
        const updated = [...existing, item];
        localStorage.setItem(key, JSON.stringify(updated));
        const reply =
          `Added **${taskTitle}** to your **Tasks tab**.\n\n` +
          `• Scheduled ${fmtTime(startMin)} – ${fmtTime(startMin + durationMin)}\n` +
          `• Estimated time: ${fmtDuration(durationMin)}\n` +
          `• Tap it on the day calendar to mark it done.`;
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch {
        setError("Couldn't save the task locally.");
      } finally {
        setBusy(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      return;
    }

    try {
      const { reply } = await ask({
        data: { messages: next.slice(-20), subtype: stored?.result.subtype },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const empty = messages.length === 0;

  return (
    <AppShell
      title="TADA"
      
      right={
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            aria-label="My profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
          >
            <User className="h-4 w-4" aria-hidden />
          </Link>
          {!empty && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
            >
              New
            </button>
          )}
        </div>
      }
    >
      {empty ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 pb-32">
          <div className="text-center">
            <h2 className="flex items-center justify-center gap-3 text-3xl font-semibold tracking-tight">
              <img
                src="/tada-logo.png"
                alt=""
                className="h-12 w-12 object-contain drop-shadow-sm"
              />
              <span className="bg-gradient-to-br from-primary via-foreground to-accent bg-clip-text text-transparent">
                TADA
              </span>
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">
              grow at your pace
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Ask a question or describe what's on your plate.
            </p>
          </div>

          <form onSubmit={onSubmit} className="w-full">
            <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask TADA…"
                className="min-h-[40px] max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Ask
              </button>
            </div>
          </form>

          <NudgeCard subtype={subtype} />


          {error && (
            <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-40">
          <ul className="space-y-2" aria-live="polite">
            {messages.map((m, i) => (
              <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <AssistantBubble content={m.content} />
                )}
              </li>
            ))}
            {busy && (
              <li className="flex justify-start">
                <div className="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </li>
            )}
          </ul>
          {error && (
            <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
          )}
          <div ref={endRef} />

          <form
            onSubmit={onSubmit}
            className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <div className="mx-auto flex max-w-md items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask a follow-up…"
                className="min-h-[44px] max-h-32 flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

const TAB_LINKS: { match: RegExp; to: "/" | "/tasks" | "/calendar" | "/mood" | "/more"; label: string; icon: string }[] = [
  { match: /\bmood\b/i, to: "/mood", label: "Open Mood", icon: "◐" },
  { match: /\btasks?\b/i, to: "/tasks", label: "Open Tasks", icon: "✓" },
  { match: /\bcalendar\b/i, to: "/calendar", label: "Open Calendar", icon: "📅" },
  { match: /\bcontent\b|\bpsychoeducation\b|\bscreener\b|\bASRS\b|\breminder/i, to: "/more", label: "Open Content", icon: "⋯" },
  { match: /\bhome\b|\bnudge\b|\bnext step\b/i, to: "/", label: "Go Home", icon: "🏠" },
];

function renderAssistant(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function tabSuggestions(text: string) {
  const seen = new Set<string>();
  const hits: { to: "/" | "/tasks" | "/calendar" | "/mood" | "/more"; label: string; icon: string }[] = [];
  for (const t of TAB_LINKS) {
    if (t.match.test(text) && !seen.has(t.to)) {
      seen.add(t.to);
      hits.push({ to: t.to, label: t.label, icon: t.icon });
    }
  }
  return hits;
}

function AssistantBubble({ content }: { content: string }) {
  const suggestions = tabSuggestions(content);
  return (
    <div className="max-w-[85%] space-y-2">
      <div className="whitespace-pre-wrap rounded-2xl border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground">
        {renderAssistant(content)}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary transition active:scale-95"
            >
              <span aria-hidden>{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}