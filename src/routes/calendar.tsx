import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  MOOD_LABELS,
  useCheckIns,
  type CheckIn,
} from "@/lib/adhd-shared";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Steady — Calendar" },
      { name: "description", content: "Month view of your mood check-ins and notes." },
    ],
  }),
  component: CalendarRoute,
});

function CalendarRoute() {
  const [history] = useCheckIns();
  const byDate = useMemo(() => {
    const m = new Map<string, CheckIn>();
    for (const c of history) m.set(c.date, c);
    return m;
  }, [history]);

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(today.toISOString().slice(0, 10));

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const firstDay = (cursor.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = new Date(cursor.getFullYear(), cursor.getMonth(), d, 12)
      .toISOString()
      .slice(0, 10);
    cells.push(iso);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const c = new Date(cursor);
    c.setMonth(c.getMonth() + delta);
    setCursor(new Date(c.getFullYear(), c.getMonth(), 1));
  }

  const sel = byDate.get(selected) ?? null;

  return (
    <AppShell
      title="Calendar"
      subtitle={monthLabel}
      right={
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm"
          >
            ›
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((iso, i) => {
              if (!iso) return <div key={i} className="aspect-square" />;
              const entry = byDate.get(iso);
              const isToday = iso === today.toISOString().slice(0, 10);
              const isSelected = iso === selected;
              const day = parseInt(iso.slice(8), 10);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(iso)}
                  aria-label={iso}
                  className={
                    "relative flex aspect-square flex-col items-center justify-center rounded-lg text-[12px] transition " +
                    (isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-secondary text-foreground"
                        : "text-foreground hover:bg-accent/40")
                  }
                >
                  <span>{day}</span>
                  {entry && (
                    <span
                      aria-hidden
                      className="mt-0.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: moodColor(entry.mood) }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span>Mood:</span>
            {[1, 2, 3, 4, 5].map((m) => (
              <span key={m} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: moodColor(m) }}
                />
                {MOOD_LABELS[m - 1]}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
            {new Date(selected).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          {sel ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>
                <span className="font-semibold">Mood:</span> {MOOD_LABELS[sel.mood - 1]}
              </p>
              {sel.focus != null && (
                <p><span className="font-semibold">Focus:</span> {sel.focus}/5</p>
              )}
              {sel.energy != null && (
                <p><span className="font-semibold">Energy:</span> {sel.energy}/5</p>
              )}
              {sel.tags && sel.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sel.tags.map((t) => (
                    <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {sel.note && (
                <p className="rounded-lg bg-accent/30 p-2 text-[13px] leading-relaxed">
                  {sel.note}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No check-in for this day.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function moodColor(mood: number) {
  // 1..5 → red → amber → yellow → green-light → green
  const map = ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#22c55e"];
  return map[Math.max(0, Math.min(4, mood - 1))];
}