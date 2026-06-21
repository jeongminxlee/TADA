import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MoodCard, CheckInCard, MoodReminderBanner } from "@/lib/adhd-shared";

export const Route = createFileRoute("/mood")({
  head: () => ({
    meta: [
      { title: "TADA AI — Mood" },
      { name: "description", content: "Daily mood log with state tags and 7/30/90-day trends." },
    ],
  }),
  component: MoodRoute,
});

function MoodRoute() {
  return (
    <AppShell title="Mood" subtitle="One tap to log. Trends below.">
      <div className="space-y-4">
        <MoodReminderBanner />
        <MoodCard />
        <CheckInCard />
      </div>
    </AppShell>
  );
}