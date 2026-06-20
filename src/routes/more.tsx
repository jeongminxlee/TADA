import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  PSYCHOED,
  MED_OPTIONS,
  NhsNextSteps,
  clearOnboarding,
  useOnboardingResult,
} from "@/lib/adhd-shared";
import { useReminderSettings, ensurePermission, notify } from "@/lib/reminders";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "Steady — Learn & settings" },
      { name: "description", content: "Psychoeducation by ADHD subtype, NHS next steps, and app settings." },
    ],
  }),
  component: MoreRoute,
});

function MoreRoute() {
  const stored = useOnboardingResult();
  const navigate = useNavigate();
  const [section, setSection] = useState<"learn" | "nhs" | "settings">("learn");
  const subtypeKey = stored?.result.key ?? "below";

  const medLabel = stored
    ? MED_OPTIONS.find((m) => m.value === stored.onboarding.meds)?.label
    : null;

  return (
    <AppShell title="More" subtitle="Learn, NHS, settings">
      <div
        role="tablist"
        aria-label="More sections"
        className="mb-4 inline-flex w-full rounded-full bg-secondary p-1 text-xs font-medium"
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
                "flex-1 rounded-full px-3 py-1.5 capitalize transition " +
                (active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground")
              }
            >
              {s === "nhs" ? "NHS" : s}
            </button>
          );
        })}
      </div>

      {section === "learn" && (
        <div className="space-y-3">
          {(["inattentive", "hyperactive", "combined", "below"] as const).map((k) => {
            const ed = PSYCHOED[k];
            const mine = k === subtypeKey;
            return (
              <article
                key={k}
                className={
                  "rounded-2xl border p-4 " +
                  (mine
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                    {ed.title}
                  </p>
                  {mine && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                      You
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold">{ed.tagline}</p>
                {ed.body.map((p, i) => (
                  <p key={i} className="mt-2 text-[13px] leading-relaxed text-foreground/90">{p}</p>
                ))}
                <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{ed.refs}</p>
              </article>
            );
          })}
        </div>
      )}

      {section === "nhs" && <NhsNextSteps partAPositive={stored?.result.partAPositive ?? false} />}

      {section === "settings" && (
        <div className="space-y-3">
          <ReminderSettings />

          {stored ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                Your screener result
              </p>
              <p className="mt-1 font-semibold">{stored.result.subtype}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Part A: {stored.result.partAShaded}/6 shaded · Age {stored.onboarding.age}
                {medLabel ? ` · ${medLabel}` : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm">
              You haven't taken the screener yet.
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate({ to: "/onboarding" })}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
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
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-destructive/40 text-sm font-medium text-destructive"
          >
            Reset all app data
          </button>

          <p className="pt-3 text-[11px] leading-relaxed text-muted-foreground">
            For educational use only and not a substitute for NHS clinical
            assessment. If you're in distress, call NHS 111 (or 999 in an
            emergency). For mental health support, contact the Samaritans on 116 123.
          </p>

          <p className="pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Scoring uses the WHO Adult ADHD Self-Report Scale (ASRS v1.1, Kessler
            et al., 2005) and DSM-5 age-adjusted symptom counts. Self-management
            content is drawn from CBT for adult ADHD (Safren et al., 2005/2010),
            Barkley (2012), and NICE NG87.
          </p>

          <p className="pt-3 text-center text-[11px] text-muted-foreground">
            <Link to="/onboarding" className="underline">View intro</Link>
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
        onClick={() => notify("Steady — test reminder", "Reminders are working.")}
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-border text-xs font-medium disabled:opacity-50"
      >
        Send a test notification
      </button>
    </div>
  );
}