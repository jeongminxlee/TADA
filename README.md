# TADA - ADHD Self-Management Companion

TADA is a non-diagnostic ADHD self-management app designed for adults in the UK. It bridges the gap between screening and diagnosis by providing tailored psychoeducation, daily planning tools, mood tracking, and an AI companion that nudges you toward actionable next steps.

## Features

- **Onboarding & Screening** - ASRS screener with ADHD subtype identification (Inattentive, Hyperactive-Impulsive, Combined, or Emotional Dysregulation)
- **Daily Task Planner** - Auto-scheduled tasks on a 24-hour calendar with estimated durations and time-blocking
- **AI Coach** - Per-task coaching (approach, first step, pitfalls, if-stuck) and a chat companion for ADHD-friendly advice
- **Mood Tracking** - Log daily mood, focus, energy, and tags; view 7/30/90-day trends with charts
- **Calendar View** - Visualise mood and task completion patterns by day
- **Psychoeducation** - Subtype-specific content, NHS next-step guidance, and medical knowledge cards broken into digestible pieces
- **Points & Rewards** - Gamified streak system with unlockable milestones
- **Reminders** - Local notification-style reminders for tasks and check-ins
- **PWA Ready** - Installable web app with offline-friendly design

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) v1 (React 19, SSR/SSG, file-based routing)
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4 with CSS theme variables
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Charts:** Recharts
- **AI:** Lovable AI Gateway (Google Gemini via OpenAI-compatible SDK)
- **Storage:** localStorage for client-side persistence (points, tasks, mood, onboarding state)

## Getting Started

### Prerequisites

- Node.js 20+ or Bun 1.2+
- A Lovable API key (for AI chat features)

### Installation

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

Create a `.env` file in the project root:

```env
# Required for AI chat and nudge features
LOVABLE_API_KEY=your_lovable_api_key_here
```

> AI features will fail gracefully with an error message if the key is missing.

## Project Structure

```
src/
  components/          # Reusable UI components (shadcn + app-specific)
  components/ui/       # shadcn/ui primitives
  hooks/               # Custom React hooks
  lib/                 # Utilities, shared logic, server functions
  lib/chat.functions.ts      # AI chat server function
  lib/nudge.functions.ts     # AI nudge server function
  lib/task-schedule.ts       # Task duration estimation & calendar scheduling
  lib/points.tsx             # Gamification system
  lib/reminders.tsx          # Local reminder runner
  lib/adhd-shared.tsx        # Subtype data, tasks, nudges, onboarding logic
  routes/              # TanStack Start file-based routes
    __root.tsx         # Root layout (head metadata, providers, tab bar)
    index.tsx          # Home dashboard (AI nudge, mood preview, rewards)
    tasks.tsx          # Daily task planner & calendar
    mood.tsx           # Mood logging & trends
    calendar.tsx       # Monthly calendar view
    more.tsx           # Content, learn, settings, profile
    onboarding.tsx     # ASRS screener & subtype onboarding
  styles.css           # Global styles, Tailwind imports, theme tokens
  router.tsx           # Router configuration
  start.ts             # Server entry (middleware)
  server.ts            # SSR error wrapper
public/                # Static assets, PWA manifest, icons
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start the development server |
| `bun run build` | Build for production |
| `bun run build:dev` | Build in development mode |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |

## Key Design Decisions

- **Client-side persistence** - The app uses `localStorage` for all user data (tasks, mood, points, onboarding). This keeps it lightweight and privacy-first. For multi-device sync or cloud backup, migrating to a backend database would be the next step.
- **ADHD-friendly UX** - Short text, clear action verbs, minimal cognitive load. No walls of text. One-thing-at-a-time flows.
- **Non-diagnostic** - TADA never diagnoses or labels conditions. It signposts to NHS GP, Right to Choose, NHS 111, and Samaritans when needed.
- **AI as a companion, not a clinician** - The AI chatbot (TADA) validates, nudges, and signposts. It does not provide medical advice.

## License

This project is proprietary. Built with [Lovable](https://lovable.dev).
