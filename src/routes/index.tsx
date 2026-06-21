import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import logoImg from "@/assets/tada-logo.png";
import {
  TASKS,
  adaptiveTask,
  loadCheckIns,
  todayISO,
  useOnboardingResult,
} from "@/lib/adhd-shared";
import { suggestNudge } from "@/lib/nudge.functions";
import { chatReply } from "@/lib/chat.functions";

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
      subtitle="Ask anything — tips, not diagnosis"
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
            <h2 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
              <img src={logoImg} alt="" aria-hidden className="h-10 w-10" />
              TADA
            </h2>
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

          <QuickNudge subtype={subtype} planKey={planKey} />

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

type Nudge = {
  task: string;
  firstStepBullets: string[];
  timeEstimate: string;
  encouragement: string;
};

function QuickNudge({
  subtype,
  planKey,
}: {
  subtype: string;
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
    <div className="w-full rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
        AI nudge
      </p>
      <p className="mt-1 text-sm font-semibold">What's the next small thing?</p>
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