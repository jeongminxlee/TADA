## Goal

Stop being a single long scroll. Turn the app into a real mobile-app shell: one screen at a time, fixed bottom tab bar, quiz only on first launch (retake from Settings). Reuse everything already built (mood card, check-in history, AI nudge, task coach, adaptive plan) and rehome it into proper screens.

## New shape

Bottom tab bar (5 tabs, fixed, thumb-reachable):

```text
┌──────────────────────────────┐
│  screen content (scrolls)    │
│                              │
│                              │
├──────────────────────────────┤
│ 🏠     ✓     📅     ◐    ⋯  │
│ Home  Tasks  Cal   Mood  More│
└──────────────────────────────┘
```

- **Home (`/`)** — today at a glance: greeting, today's mood snapshot, next adaptive task, AI nudge card, streak chip, quick-log mood button.
- **Tasks (`/tasks`)** — full plan (adaptive + subtype + medication tasks) + the user's own to-do list with per-task AI coach. Add quick-add input at top.
- **Calendar (`/calendar`)** — month grid showing mood dot per day + task-completion ring. Tap a day → that day's check-in, tags, note, completed tasks.
- **Mood (`/mood`)** — standalone mood logger + tags + note + 7/30/90-day trends (existing MoodCard + CheckInCard merged onto one screen).
- **More (`/more`)** — list page: Learn (psychoeducation by subtype: Inattentive / Hyperactive / Combined), NHS next steps, Settings (retake quiz, view ASRS result, age/meds, reminder toggle, reset data).

Quiz: first launch routes to `/onboarding` (Intro → ASRS items → age/meds → score → psychoeducation for their subtype → "Continue to app"). After that, `/` always lands on Home. Retake from More → Settings.

## Screens — what goes on each

**Home**
- Header: greeting + today date + subtype badge (small, tappable → opens result detail).
- Mood snapshot card: today's logged mood (emoji + label) OR "Log today's mood" CTA → opens Mood tab.
- Adaptive next-step card: pulls `adaptiveTask(todayCheckIn)` — same logic as today. Big tick button.
- AI nudge card: "Suggest my next step" button, reads today's check-in + task list.
- Streak chip: consecutive days with a check-in.

**Tasks**
- Quick-add input (existing NudgeCard input promoted).
- "Today's plan" list (adaptive + subtype + medication, with badges) — existing logic.
- "Your tasks" list with per-item "Coach me" expandable panel — existing coachTask logic.
- Completion saved per-day in localStorage (already done).

**Calendar**
- Month grid, 7-col. Each day cell: small coloured dot for mood (1–5 → 5 colours), thin ring for % tasks done.
- Tap day → bottom sheet / inline panel with that day's mood, focus, energy, tags, note, and which plan items were checked.
- Prev/next month chevrons.

**Mood**
- Today: 1–5 mood picker (1-tap commit), focus + energy sliders (optional), tag chips, note field.
- Trends: existing 7/30/90 toggle, averages, sparkline.
- Reminder toggle (in-app banner if today not logged — already built as MoodReminderBanner, surfaces on Home).

**More**
- "Learn" — three psychoeducation cards (Inattentive, Hyperactive, Combined) with plain-English summary + NICE NG87 / Safren / Barkley citations. Subtype card highlighted.
- "Get NHS help" — existing NhsNextSteps content.
- "Settings" — retake quiz, current ASRS Part A score, age, meds, other meds, "Reset all data", "Scoring methodology" expandable.

## Visual / interaction rules for the app shell

- Fixed bottom tab bar (`fixed bottom-0`, safe-area-inset-bottom padding, 64px tall, 5 icons + labels).
- Each screen is a scrollable column with `pb-24` so the tab bar never covers content.
- Sticky top app bar per screen with screen title + optional right-side action (e.g. Mood: "today" date toggle).
- One H1 per screen (the screen title). Active tab uses the primary colour; inactive tabs muted.
- Tap targets ≥44px. Cards span full width with 16px gutter.
- No structural changes to colours/typography — same tokens, same NHS-compatible palette.

## Routing & state

- New routes: `src/routes/onboarding.tsx`, `src/routes/tasks.tsx`, `src/routes/calendar.tsx`, `src/routes/mood.tsx`, `src/routes/more.tsx`. `src/routes/index.tsx` becomes Home.
- New layout in `src/routes/__root.tsx`: renders `<Outlet />` plus the fixed bottom `<TabBar />`. Hide the tab bar on `/onboarding`.
- First-launch redirect: a small client effect in `__root.tsx` reads `localStorage["adhd-onboarded-v1"]`. If absent and route is `/`, navigate to `/onboarding`. Completing onboarding sets the flag and navigates to `/`.
- Persistence stays in localStorage (existing keys: `adhd-checkins-v1`, `adhd-nudge-tasks-v1`, `adhd-tasks-…`). Add `adhd-onboarding-v1` (age/meds/otherMeds/asrs result) and `adhd-onboarded-v1` (boolean flag).
- Settings → "Retake quiz" clears the flag and routes to `/onboarding`.

## Viewport

Preview switches to mobile (375×812) so the layout is designed against the real form factor. User can toggle back to desktop with the device button above the preview.

## Scope notes / deferrals

- **Push reminders, true calendar invites, rewards/XP system, content authoring beyond the three subtype cards** — out of scope for this restructure. Calendar is a read-only history view, not an event scheduler. Reminders stay as the existing in-app banner. Happy to add any of these as a follow-up.
- **No backend changes.** Everything stays client-side in localStorage. If you want sync across devices later, that's a Lovable Cloud follow-up.

## Files touched

- Edit: `src/routes/__root.tsx` (app shell + tab bar + onboarding redirect), `src/routes/index.tsx` (slim down to Home only, extract reusable bits).
- New: `src/routes/onboarding.tsx`, `src/routes/tasks.tsx`, `src/routes/calendar.tsx`, `src/routes/mood.tsx`, `src/routes/more.tsx`.
- New components: `src/components/tab-bar.tsx`, `src/components/app-header.tsx`, `src/components/calendar-grid.tsx`, `src/components/psychoed-card.tsx`.
- Extract from current `index.tsx` into `src/lib/` so screens can share: `asrs.ts` (items, scoring, TASKS, MED_TASK, adaptiveTask), `checkins.ts` (schema, hooks, storage), `onboarding-store.ts` (persisted onboarding + result).

After your approval I'll switch the preview to mobile, scaffold the new routes, extract the shared logic, and move the existing cards into their new screens without changing their behaviour.