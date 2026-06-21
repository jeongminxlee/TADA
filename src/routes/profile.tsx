import { createFileRoute, Link } from "@tanstack/react-router";
import { User, ChevronLeft, Pill, CalendarDays, Stethoscope, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  MED_OPTIONS,
  clearOnboarding,
  useOnboardingResult,
} from "@/lib/adhd-shared";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "TADA — My Profile" },
      { name: "description", content: "View your screener result and app settings." },
    ],
  }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const stored = useOnboardingResult();

  const medLabel = stored
    ? MED_OPTIONS.find((m) => m.value === stored.onboarding.meds)?.label
    : null;

  const otherMedLabel = stored?.onboarding.otherMeds
    ? stored.onboarding.otherMeds === "yes"
      ? "Yes"
      : stored.onboarding.otherMeds === "no"
        ? "No"
        : "Prefer not to say"
    : null;

  const completedDate = stored?.completedAt
    ? new Date(stored.completedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <AppShell title="My profile" subtitle="Your screener & settings">
      <div className="space-y-4">
        {!stored ? (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm">
            <User className="mx-auto h-8 w-8 text-primary/60" aria-hidden />
            <p className="mt-3 font-medium">No profile yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete the screener to see your results here.
            </p>
            <Link
              to="/onboarding"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Start the screener
            </Link>
          </div>
        ) : (
          <>
            {/* Result card */}
            <div
              className={
                "rounded-2xl border p-4 " +
                (stored.result.partAPositive
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card")
              }
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                Screener result
              </p>
              <h2 className="mt-1 text-lg font-semibold">{stored.result.subtype}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Part A: {stored.result.partAShaded}/6 shaded ·{" "}
                {stored.result.partAPositive
                  ? "Warrants further assessment"
                  : "Below screening threshold"}
              </p>
            </div>

            {/* Details card */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                Your details
              </p>

              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div>
                  <p className="text-xs text-muted-foreground">Age</p>
                  <p className="text-sm font-medium">{stored.onboarding.age}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Pill className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div>
                  <p className="text-xs text-muted-foreground">ADHD medication</p>
                  <p className="text-sm font-medium">{medLabel ?? "—"}</p>
                </div>
              </div>

              {otherMedLabel && (
                <div className="flex items-center gap-3">
                  <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Other medication</p>
                    <p className="text-sm font-medium">{otherMedLabel}</p>
                  </div>
                </div>
              )}

              {completedDate && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Screener completed</p>
                    <p className="text-sm font-medium">{completedDate}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Link
                to="/onboarding"
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
              >
                Retake the screener
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.confirm("Clear screener result, mood log, and tasks?")
                  ) {
                    ["adhd-checkins-v1", "adhd-nudge-tasks-v1", "adhd-home-nudge"].forEach((k) =>
                      localStorage.removeItem(k),
                    );
                    clearOnboarding();
                    window.location.href = "/onboarding";
                  }
                }}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-destructive/40 text-sm font-medium text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Reset all app data
              </button>
            </div>
          </>
        )}

        <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground text-center">
          For educational use only and not a substitute for NHS clinical
          assessment. If you&apos;re in distress, call NHS 111 (or 999 in an
          emergency).
        </p>
      </div>
    </AppShell>
  );
}
