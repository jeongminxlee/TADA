import { useState, useEffect } from "react";
import { toast } from "sonner";

const POINTS_KEY = "adhd-points-v1";
const CLAIMED_KEY = "adhd-rewards-claimed-v1";

export const REWARDS: { threshold: number; label: string; emoji: string; blurb: string }[] = [
  { threshold: 50, label: "Sprout", emoji: "🌱", blurb: "Got started — that's the hardest part." },
  { threshold: 150, label: "Bloom", emoji: "🌿", blurb: "Building real momentum." },
  { threshold: 300, label: "Grove", emoji: "🌳", blurb: "Consistency is paying off." },
  { threshold: 600, label: "TADA Legend", emoji: "✨", blurb: "You're showing up for yourself." },
];

export function usePoints() {
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

export function seedPoints(points: number, claimed: number[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POINTS_KEY, String(points));
  localStorage.setItem(CLAIMED_KEY, JSON.stringify(claimed));
}

export function RewardsCard({ points }: { points: number }) {
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
