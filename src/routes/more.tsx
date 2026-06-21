import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  PSYCHOED,
  MED_OPTIONS,
  MEDICAL_DECODED,
  TASKS,
  NhsNextSteps,
  clearOnboarding,
  useOnboardingResult,
} from "@/lib/adhd-shared";
import { useReminderSettings, ensurePermission, notify } from "@/lib/reminders";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "TADA — Content" },
      { name: "description", content: "Psychoeducation by ADHD subtype, NHS next steps, and app settings." },
    ],
  }),
  component: MoreRoute,
});

function MoreRoute() {
  const stored = useOnboardingResult();
  const navigate = useNavigate();
  const [section, setSection] = useState<"learn" | "nhs" | "settings">("learn");
  const [decodedFilter, setDecodedFilter] = useState<"All" | "Diagnosis" | "Brain" | "Symptoms" | "Treatment" | "Co-occurring">("All");
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const subtypeKey = stored?.result.key ?? "below";

  const medLabel = stored
    ? MED_OPTIONS.find((m) => m.value === stored.onboarding.meds)?.label
    : null;

  const tabMeta: Record<"learn" | "nhs" | "settings", { label: string; icon: string }> = {
    learn: { label: "Learn", icon: "✦" },
    nhs: { label: "NHS", icon: "✚" },
    settings: { label: "Settings", icon: "⚙" },
  };

  return (
    <AppShell title="Content" subtitle="Learn, NHS, settings">
      <div
        role="tablist"
        aria-label="More sections"
        className="mb-5 inline-flex w-full rounded-full border border-border/60 bg-secondary/70 p-1 text-xs font-medium shadow-sm backdrop-blur"
      >
        {(["learn", "nhs", "settings"] as const).map((s) => {
          const active = section === s;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setSection(s)}
              className={
                "flex-1 rounded-full px-3 py-2 capitalize transition-all duration-300 ease-out " +
                (active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-primary/15"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <span className="mr-1.5 text-primary/70">{tabMeta[s].icon}</span>
              {tabMeta[s].label}
            </button>
          );
        })}
      </div>

      {section === "learn" && (
        <div className="space-y-4">
          <header className="px-1">
            <h2 className="text-lg font-semibold tracking-tight">Understand your subtype</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Four ADHD presentations, written in plain English.
            </p>
          </header>
          {(["inattentive", "hyperactive", "combined", "below"] as const).map((k) => {
            const ed = PSYCHOED[k];
            const mine = k === subtypeKey;
            return (
              <article
                key={k}
                className={
                  "group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md " +
                  (mine
                    ? "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/30")
                }
              >
                <div className="relative h-36 w-full overflow-hidden">
                  <img
                    src={ed.image}
                    alt={ed.imageAlt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  <div className="absolute left-4 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
                    <span className="text-base leading-none">{ed.emoji}</span>
                    <span className="uppercase tracking-[0.12em] text-primary">{ed.title}</span>
                  </div>
                  {mine && (
                    <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
                      ✦ You
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-base font-semibold leading-snug">{ed.tagline}</p>

                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      What it looks like
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {ed.looksLike.map((item, i) => (
                        <li key={i} className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] leading-snug">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      What tends to help
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {ed.helps.map((item, i) => (
                        <li key={i} className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[13px] leading-snug">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="mt-4 border-t border-border/60 pt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {ed.refs}
                  </p>
                </div>
              </article>
            );
          })}

          <section className="pt-2">
            <header className="px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Decoded</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Medical terms, in plain English</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The clinical language you'll hear from your GP, psychiatrist, or in the research — translated.
              </p>
            </header>

            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {(["All", "Diagnosis", "Brain", "Symptoms", "Treatment", "Co-occurring"] as const).map((c) => {
                const active = decodedFilter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDecodedFilter(c)}
                    className={
                      "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:text-foreground")
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <ul className="mt-3 space-y-2.5">
              {MEDICAL_DECODED.filter(
                (d) => decodedFilter === "All" || d.category === decodedFilter,
              ).map((d) => {
                const open = openTerm === d.term;
                return (
                  <li
                    key={d.term}
                    className="overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenTerm(open ? null : d.term)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">
                        {d.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                            {d.category}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold leading-snug">{d.term}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                          {d.shortDef}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={
                          "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs text-foreground transition-transform " +
                          (open ? "rotate-45" : "")
                        }
                      >
                        +
                      </span>
                    </button>

                    {open && (
                      <div className="border-t border-border/70 bg-gradient-to-b from-secondary/30 to-transparent px-4 pb-4 pt-3">
                        <p className="text-[13px] leading-relaxed text-foreground/90">
                          {d.inPlainEnglish}
                        </p>
                        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          In everyday life
                        </p>
                        <ul className="mt-1.5 space-y-1.5">
                          {d.everyday.map((e, i) => (
                            <li
                              key={i}
                              className="rounded-xl bg-background px-3 py-2 text-[12.5px] leading-snug shadow-sm"
                            >
                              {e}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Source · {d.source}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {section === "nhs" && (
        <div className="space-y-4">
          <header className="px-1">
            <h2 className="text-lg font-semibold tracking-tight">Next steps with the NHS</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How to take this forward with your GP.
            </p>
          </header>
          <NhsNextSteps partAPositive={stored?.result.partAPositive ?? false} />
        </div>
      )}

      {section === "settings" && (
        <div className="space-y-4">
          <header className="px-1">
            <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Reminders, screener and app data.
            </p>
          </header>
          <ReminderSettings />

          {stored ? (
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 text-sm shadow-sm">
              <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Your screener result
              </p>
              <p className="mt-2 text-base font-semibold">{stored.result.subtype}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Part A: {stored.result.partAShaded}/6 shaded · Age {stored.onboarding.age}
                {medLabel ? ` · ${medLabel}` : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-sm">
              <p className="font-medium">No screener result yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Take the short questionnaire to personalise your experience.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate({ to: "/onboarding" })}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:brightness-105 hover:shadow-md active:scale-[0.99]"
          >
            {stored ? "Retake the screener" : "Start the screener"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.confirm("Clear screener result, mood log, and tasks?")) {
                ["adhd-checkins-v1", "adhd-nudge-tasks-v1", "adhd-home-nudge"].forEach((k) => localStorage.removeItem(k));
                clearOnboarding();
                navigate({ to: "/onboarding" });
              }
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-destructive/40 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            Reset all app data
          </button>

          <div className="mt-2 rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Safety</p>
            <p className="mt-2 text-[12px] leading-relaxed text-foreground/80">
              For educational use only and not a substitute for NHS clinical
              assessment. If you're in distress, call NHS 111 (or 999 in an
              emergency). For mental health support, contact the Samaritans on 116 123.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sources</p>
            <p className="mt-2 text-[12px] leading-relaxed text-foreground/80">
              Scoring uses the WHO Adult ADHD Self-Report Scale (ASRS v1.1, Kessler
              et al., 2005) and DSM-5 age-adjusted symptom counts. Self-management
              content is drawn from CBT for adult ADHD (Safren et al., 2005/2010),
              Barkley (2012), and NICE NG87.
            </p>
          </div>

          <p className="pt-2 text-center text-[11px] text-muted-foreground">
            <Link to="/onboarding" className="underline underline-offset-2 hover:text-primary">View intro</Link>
          </p>
        </div>
      )}
    </AppShell>
  );
}

function ReminderSettings() {
  const [settings, update] = useReminderSettings();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  const supported = perm !== "unsupported";

  const handleToggle = async () => {
    if (!settings.enabled) {
      const p = await ensurePermission();
      setPerm(p);
      if (p !== "granted") return;
    }
    update({ enabled: !settings.enabled });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
        Reminders
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Browser notifications nudging you to log mood and check today's plan.
      </p>

      {!supported && (
        <p className="mt-3 rounded-lg bg-muted p-2 text-[12px] text-muted-foreground">
          Your browser doesn't support notifications.
        </p>
      )}

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="font-medium">Enable reminders</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          disabled={!supported}
          onClick={handleToggle}
          className={
            "relative inline-flex h-6 w-11 items-center rounded-full transition " +
            (settings.enabled ? "bg-primary" : "bg-muted") +
            (!supported ? " opacity-50" : "")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-background shadow transition " +
              (settings.enabled ? "translate-x-5" : "translate-x-0.5")
            }
          />
        </button>
      </label>

      {perm === "denied" && (
        <p className="mt-2 text-[12px] text-destructive">
          Notifications are blocked in your browser. Enable them in site settings, then toggle again.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs">
          <span className="block font-medium text-foreground">Task nudge</span>
          <input
            type="time"
            value={settings.taskTime}
            onChange={(e) => update({ taskTime: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="block font-medium text-foreground">Mood log</span>
          <input
            type="time"
            value={settings.moodTime}
            onChange={(e) => update({ moodTime: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={!supported || perm !== "granted"}
        onClick={() => notify("TADA — test reminder", "Reminders are working.")}
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-border text-xs font-medium disabled:opacity-50"
      >
        Send a test notification
      </button>
    </div>
  );
}