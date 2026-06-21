import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useOnboardingResult } from "@/lib/adhd-shared";
import { chatReply } from "@/lib/chat.functions";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Steady — Chat coach" },
      { name: "description", content: "Chat with a non-diagnostic ADHD coach. Get tips and pointers to the right in-app tool." },
    ],
  }),
  component: ChatRoute,
});

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "adhd-chat-v1";
const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hi, I'm Steady. Tell me what's on your plate or how you're feeling. I won't diagnose — I'll suggest tips or point you to the right tool in this app.",
};

function loadMessages(): Msg[] {
  if (typeof window === "undefined") return [WELCOME];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as Msg[];
  } catch {
    /* noop */
  }
  return [WELCOME];
}

function ChatRoute() {
  const stored = useOnboardingResult();
  const send = useServerFn(chatReply);
  const [messages, setMessages] = useState<Msg[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* quota */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const convo = next.filter((m, i) => !(i === 0 && m.role === "assistant"));
      const { reply } = await send({
        data: {
          messages: convo.slice(-20),
          subtype: stored?.result.subtype,
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const reset = () => {
    setMessages([WELCOME]);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  return (
    <AppShell
      title="Coach chat"
      subtitle="Tips, not diagnosis"
      right={
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
        >
          New chat
        </button>
      }
    >
      <div className="flex flex-col gap-3 pb-32">
        <p className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Steady offers self-management tips and points you to features in this app.
          It does <strong>not</strong> diagnose. In a crisis, call 999 or Samaritans on 116 123.
        </p>

        <ul className="space-y-2" aria-live="polite">
          {messages.map((m, i) => (
            <li
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed " +
                  (m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border")
                }
              >
                {renderAssistant(m.content)}
              </div>
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
      </div>

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
            placeholder="What's on your mind?"
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
    </AppShell>
  );
}

function renderAssistant(text: string) {
  // Lightweight **bold** rendering so tab name highlights show up.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}