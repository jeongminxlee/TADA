import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { suggestNudge, coachTask } from "@/lib/nudge.functions";

// WHO Adult ADHD Self-Report Scale (ASRS v1.1) — Kessler et al., 2005.
// The 18-item adult-worded version of the DSM criteria. Items 1–6 form the
// validated Part A screener; 4+ "shaded" responses indicates symptoms
// highly consistent with adult ADHD. All 18 items map to the inattention
// or hyperactive/impulsive domain for subtype scoring.
export type Domain = "Inattention" | "Hyperactivity & Impulsivity";

export type AsrsItem = {
  num: number;            // official ASRS item number (1–18)
  text: string;           // item wording
  domain: Domain;         // for DSM subtype scoring
  partA: boolean;         // belongs to the validated 6-item screener
  shadeFrom?: 2 | 3;      // Part A only: lowest "shaded" response value
};

export const ASRS: AsrsItem[] = [
  // ---- Part A (validated screener) ----
  { num: 1, partA: true, shadeFrom: 2, domain: "Inattention",
    text: "How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?" },
  { num: 2, partA: true, shadeFrom: 2, domain: "Inattention",
    text: "How often do you have difficulty getting things in order when you have to do a task that requires organization?" },
  { num: 3, partA: true, shadeFrom: 2, domain: "Inattention",
    text: "How often do you have problems remembering appointments or obligations?" },
  { num: 4, partA: true, shadeFrom: 3, domain: "Inattention",
    text: "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?" },
  { num: 5, partA: true, shadeFrom: 3, domain: "Hyperactivity & Impulsivity",
    text: "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?" },
  { num: 6, partA: true, shadeFrom: 3, domain: "Hyperactivity & Impulsivity",
    text: "How often do you feel overly active and compelled to do things, like you were driven by a motor?" },
  // ---- Part B ----
  { num: 7, partA: false, domain: "Inattention",
    text: "How often do you make careless mistakes when you have to work on a boring or difficult project?" },
  { num: 8, partA: false, domain: "Inattention",
    text: "How often do you have difficulty keeping your attention when you are doing boring or repetitive work?" },
  { num: 9, partA: false, domain: "Inattention",
    text: "How often do you have difficulty concentrating on what people say to you, even when they are speaking to you directly?" },
  { num: 10, partA: false, domain: "Inattention",
    text: "How often do you misplace or have difficulty finding things at home or at work?" },
  { num: 11, partA: false, domain: "Inattention",
    text: "How often are you distracted by activity or noise around you?" },
  { num: 12, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often do you leave your seat in meetings or other situations in which you are expected to remain seated?" },
  { num: 13, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often do you feel restless or fidgety?" },
  { num: 14, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often do you have difficulty unwinding and relaxing when you have time to yourself?" },
  { num: 15, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often do you find yourself talking too much when you are in social situations?" },
  { num: 16, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often, when you're in a conversation, do you find yourself finishing the sentences of the people you are talking to before they can finish them themselves?" },
  { num: 17, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often do you have difficulty waiting your turn in situations when turn-taking is required?" },
  { num: 18, partA: false, domain: "Hyperactivity & Impulsivity",
    text: "How often do you interrupt others when they are busy?" },
];

export const SCALE = [
  { label: "Never", hint: "Not really me", value: 0 },
  { label: "Rarely", hint: "Once in a while", value: 1 },
  { label: "Sometimes", hint: "Here and there", value: 2 },
  { label: "Often", hint: "Most weeks", value: 3 },
  { label: "Very often", hint: "Pretty much always", value: 4 },
];

// Per DSM-5, a symptom "counts" toward the subtype threshold if it occurs
// often or very often (>= 3 on this 0–4 scale). The number-of-symptoms
// threshold is age-dependent: children/adolescents <17 need 6+, adults
// (17+) need 5+ in a domain (DSM-5, APA 2013).
export const COUNT_THRESHOLD = 3;

export type MedStatus = "none" | "considering" | "current" | "former";

export const MED_OPTIONS: { value: MedStatus; label: string; hint: string }[] = [
  { value: "none", label: "Not on medication", hint: "Never been prescribed" },
  { value: "considering", label: "Considering / pending eval", hint: "Looking into it" },
  { value: "current", label: "Currently taking", hint: "Stimulant or non-stimulant" },
  { value: "former", label: "Took it previously", hint: "Not currently on it" },
];

// Zod schema validates the onboarding payload on the client before we use
// it to set thresholds and tailor tasks.
export const OnboardingSchema = z.object({
  age: z
    .number({ invalid_type_error: "Enter your age as a number" })
    .int("Enter a whole number")
    .min(18, "Must be 18 or older")
    .max(120, "Enter a realistic age"),
  meds: z.enum(["none", "considering", "current", "former"]),
  otherMeds: z.enum(["yes", "no", "preferNot"]).optional(),
});
export type OnboardingData = z.infer<typeof OnboardingSchema>;

export type Answers = Record<string, number | null>;

export type Q = { key: string; text: string; domain: Domain; partA: boolean };

// ----- Daily check-in -----
export const CheckInSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  mood: z.number().int().min(1).max(5),
  focus: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().min(1).max(24)).max(8).optional(),
  note: z.string().trim().max(280).optional(),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"];
export const FOCUS_LABELS = ["Scattered", "Foggy", "Okay", "Locked in", "Laser"];
export const ENERGY_LABELS = ["Empty", "Tired", "Steady", "Charged", "Buzzing"];

// Common ADHD-relevant mood / state tags. Curated so they're quick to scan
// but cover the states people commonly want to note alongside a mood rating.
export const MOOD_TAGS = [
  "anxious",
  "restless",
  "overwhelmed",
  "hyperfocused",
  "scattered",
  "irritable",
  "motivated",
  "calm",
  "tired",
  "low",
  "wired",
  "bored",
];

const CHECKIN_EVENT = "adhd-checkins-changed";

function emitCheckInChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHECKIN_EVENT));
}

export function useCheckIns(): [CheckIn[], (next: CheckIn[]) => void] {
  const [history, setHistory] = useState<CheckIn[]>(() => loadCheckIns());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setHistory(loadCheckIns());
    window.addEventListener(CHECKIN_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHECKIN_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const update = (next: CheckIn[]) => {
    setHistory(next);
    saveCheckIns(next);
    emitCheckInChange();
  };
  return [history, update];
}

const CHECKIN_KEY = "adhd-checkins-v1";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function loadCheckIns(): CheckIn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKIN_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => CheckInSchema.safeParse(r))
      .filter((p) => p.success)
      .map((p) => (p as { success: true; data: CheckIn }).data);
  } catch {
    return [];
  }
}

export function saveCheckIns(list: CheckIn[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(list));
}

// Present items in their official ASRS order (Part A first).
export const QUESTIONS: Q[] = ASRS.map((it) => ({
  key: `Q${it.num}`,
  text: it.text,
  domain: it.domain,
  partA: it.partA,
}));

// Daily tasks drawn from clinical literature on ADHD management:
// CBT for adult ADHD (Safren et al., 2005, 2010), Barkley's executive
// function framework (2012), NICE guideline NG87, and CHADD clinical
// summaries. Each task targets a mechanism shown to reduce functional
// impairment in that symptom domain.
export type Task = { title: string; why: string };

export const TASKS: Record<
  "inattentive" | "hyperactive" | "combined" | "below",
  { headline: string; tasks: Task[] }
> = {
  inattentive: {
    headline:
      "Daily plan to support attention, memory, and follow-through",
    tasks: [
      {
        title: "Do a 5-minute morning planning ritual",
        why: "Externalizing the day's 1–3 priorities on paper offloads working memory and is a core Safren CBT module for adult ADHD.",
      },
      {
        title: "Use one capture inbox for every task and idea",
        why: "A single trusted list (paper or app) prevents forgotten obligations — a top predictor of impairment in inattentive ADHD.",
      },
      {
        title: "Work in two 25-minute focus blocks with a visible timer",
        why: "Time-boxing and external timers compensate for time-blindness and sustain effort on low-stimulation tasks (Barkley, 2012).",
      },
      {
        title: "Body-double or use a 'launchpad' for one avoided task",
        why: "Pairing an aversive task with a person, call, or fixed spot raises activation — addresses task-initiation failure.",
      },
      {
        title: "Do a 3-minute end-of-day shutdown review",
        why: "Reviewing what got done and parking tomorrow's first step reduces next-day startup friction (CBT-ADHD, NICE NG87).",
      },
    ],
  },
  hyperactive: {
    headline: "Daily plan to channel restlessness and reduce impulsivity",
    tasks: [
      {
        title: "Move first thing — 20–30 minutes of moderate exercise",
        why: "Aerobic activity acutely improves response inhibition and lowers restlessness; consistent finding across ADHD exercise meta-analyses.",
      },
      {
        title: "Schedule structured movement breaks every 60–90 minutes",
        why: "Planned breaks prevent the seated-restlessness build-up that drives impulsive task-switching.",
      },
      {
        title: "Practice the 'pause-and-name' rule before sending or speaking",
        why: "A 10-second pause before replies/decisions targets impulsive verbal and behavioral intrusions (CBT impulse-control module).",
      },
      {
        title: "Use a fidget, standing desk, or walking meeting once today",
        why: "Permitting controlled motor outlets is a recommended environmental modification (CHADD, Barkley).",
      },
      {
        title: "Protect a fixed wind-down window with no screens",
        why: "Sleep restriction worsens impulsivity the next day; consistent sleep timing is a first-line behavioral intervention.",
      },
    ],
  },
  combined: {
    headline:
      "Daily plan blending attention scaffolds with impulse and energy regulation",
    tasks: [
      {
        title: "Morning: move 20+ minutes, then plan top 3 tasks",
        why: "Exercise primes executive function; planning right after captures that window (Safren CBT + exercise literature).",
      },
      {
        title: "Time-box work in 25/5 cycles with a visible timer",
        why: "External time cues address both time-blindness and the urge to switch tasks impulsively.",
      },
      {
        title: "Use one capture inbox + a 'parking lot' for stray ideas",
        why: "Catching intrusive thoughts on paper lets you keep working instead of acting on them.",
      },
      {
        title: "Pause 10 seconds before sending messages or saying yes",
        why: "A brief delay reduces impulsive commitments and interrupts — a high-yield CBT skill in combined presentation.",
      },
      {
        title: "Fixed bedtime and 3-minute shutdown review",
        why: "Sleep regularity and end-of-day review together reduce next-day impulsivity and forgetting (NICE NG87).",
      },
    ],
  },
  below: {
    headline: "General executive-function support",
    tasks: [
      {
        title: "Write today's top 3 priorities before opening any inbox",
        why: "Pre-commitment to priorities protects against reactive task-switching.",
      },
      {
        title: "Move for 20+ minutes",
        why: "Aerobic exercise reliably improves attention and mood across populations.",
      },
      {
        title: "Take one screen-free 10-minute break",
        why: "Brief attentional rest restores sustained-attention capacity.",
      },
      {
        title: "Keep a consistent sleep window",
        why: "Sleep regularity is one of the strongest modifiable predictors of next-day focus.",
      },
      {
        title: "End the day with a 3-minute review",
        why: "Reflection consolidates learning and reduces tomorrow's startup friction.",
      },
    ],
  },
};

// Medication-specific reminders layered on top of the subtype plan.
// Grounded in MTA follow-up data (Jensen et al., 2007), NICE NG87, and
// CHADD guidance on combining pharmacological + behavioral treatment.
export const MED_TASK: Record<MedStatus, Task | null> = {
  none: null,
  considering: {
    title: "Note one symptom example to share with a clinician",
    why: "Concrete, recent examples make assessment faster and more accurate (NICE NG87 assessment guidance).",
  },
  current: {
    title: "Take medication on schedule and log how today felt (1–5)",
    why: "Daily ratings help you and your prescriber spot dose timing or side-effect patterns. Behavioral skills + medication outperform either alone (MTA follow-up; NICE NG87).",
  },
  former: {
    title: "Note today's hardest symptom moment for your next review",
    why: "Tracking symptom impact off-medication informs whether to revisit pharmacological options with a clinician.",
  },
};

export function ageThreshold(age: number) {
  // DSM-5: 6+ symptoms for under 17, 5+ for 17 and older
  return age < 17 ? 6 : 5;
}

// Adaptive task derived from the latest daily check-in. We translate the
// user's current mood / focus / energy / state tags into a single
// evidence-aligned action drawn from the same literature as the static
// plan (Safren CBT-ADHD, Barkley 2012, NICE NG87). This is what makes the
// dashboard responsive to symptom changes day-to-day.
export function adaptiveTask(c: CheckIn | null): { task: Task; reason: string } | null {
  if (!c) return null;
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  const has = (t: string) => tags.includes(t);

  if (has("overwhelmed") || has("anxious")) {
    return {
      task: {
        title: "Brain-dump for 3 minutes, then circle one thing",
        why: "Externalising everything on your mind reduces cognitive load and lowers anxiety before choosing a next step (CBT-ADHD).",
      },
      reason: `You logged feeling ${tags.find((t) => t === "overwhelmed" || t === "anxious")} today.`,
    };
  }
  if (has("restless") || has("wired")) {
    return {
      task: {
        title: "Take a 5-minute brisk walk, then start the next task",
        why: "Short movement bursts down-regulate hyperarousal and improve response inhibition for the next 20–30 minutes.",
      },
      reason: "You logged restless/wired energy — channel it before sitting back down.",
    };
  }
  if (has("low") || (c.mood !== null && c.mood !== undefined && c.mood <= 2)) {
    return {
      task: {
        title: "Pick the smallest possible 2-minute task and do it now",
        why: "On low-mood days, momentum from a tiny win is more reliable than willpower (behavioural activation; CBT-ADHD).",
      },
      reason: "Your mood check-in is low today — keep the bar small.",
    };
  }
  if (c.energy !== null && c.energy !== undefined && c.energy <= 2) {
    return {
      task: {
        title: "Shrink today's top task to one 10-minute slice",
        why: "Matching task size to current energy prevents the all-or-nothing crash typical in ADHD low-energy days.",
      },
      reason: "Energy is low — work with it, not against it.",
    };
  }
  if (c.focus !== null && c.focus !== undefined && c.focus >= 4) {
    return {
      task: {
        title: "Ride the focus — start the hardest task in a 25-min block",
        why: "Protect rare high-focus windows for high-effort work; this is the highest-yield use of executive function (Barkley, 2012).",
      },
      reason: "Focus is high — spend it on what matters most.",
    };
  }
  if (has("hyperfocused")) {
    return {
      task: {
        title: "Set a 45-minute alarm and a transition cue",
        why: "Hyperfocus is productive but blocks task-switching; an external stop signal prevents over-running other commitments.",
      },
      reason: "You're in hyperfocus — protect it without losing the day.",
    };
  }
  if (has("scattered") || (c.focus !== null && c.focus !== undefined && c.focus <= 2)) {
    return {
      task: {
        title: "Write your next single action on paper, then start a 10-min timer",
        why: "A visible cue plus an external timer compensates for scattered attention better than re-reading a long list.",
      },
      reason: "Focus is scattered — make the next step external and concrete.",
    };
  }
  return null;
}

export function Index() {
  const total = QUESTIONS.length;
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0); // 0..total-1 = questions, total = results, -1 = intro
  const [phase, setPhase] = useState<"intro" | "onboarding" | "quiz">("intro");
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [pulse, setPulse] = useState(0);

  const started = phase === "quiz";
  const threshold = onboarding ? ageThreshold(onboarding.age) : 5;
  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const submitted = started && step >= total;
  const currentQ = !submitted && started ? QUESTIONS[step] : null;
  const progress = Math.round((answered / total) * 100);

  const result = useMemo(() => {
    const inattItems = ASRS.filter((i) => i.domain === "Inattention");
    const hyperItems = ASRS.filter((i) => i.domain === "Hyperactivity & Impulsivity");

    const inattCount = inattItems.filter(
      (it) => (answers[`Q${it.num}`] ?? -1) >= COUNT_THRESHOLD,
    ).length;
    const hyperCount = hyperItems.filter(
      (it) => (answers[`Q${it.num}`] ?? -1) >= COUNT_THRESHOLD,
    ).length;

    // ASRS Part A validated screener: 4+ "shaded" answers across items 1–6.
    const partAItems = ASRS.filter((i) => i.partA);
    const partAShaded = partAItems.filter(
      (it) => (answers[`Q${it.num}`] ?? -1) >= (it.shadeFrom ?? 3),
    ).length;
    const partAPositive = partAShaded >= 4;

    const inattMet = inattCount >= threshold;
    const hyperMet = hyperCount >= threshold;

    let subtype = "Below DSM-5 symptom threshold";
    let key: "inattentive" | "hyperactive" | "combined" | "below" = "below";
    let description =
      "Your responses don't reach the DSM-5 symptom threshold for an ADHD presentation. Symptoms may still affect you — consider speaking with a clinician if they cause distress or impairment.";
    if (inattMet && hyperMet) {
      subtype = "Combined Presentation";
      key = "combined";
      description =
        "You endorsed enough symptoms in both the inattentive and the hyperactive-impulsive domains to meet the DSM-5 symptom threshold for the Combined Presentation.";
    } else if (inattMet) {
      subtype = "Predominantly Inattentive Presentation";
      key = "inattentive";
      description =
        "You endorsed enough inattentive symptoms to meet the DSM-5 threshold, without reaching it for the hyperactive-impulsive domain.";
    } else if (hyperMet) {
      subtype = "Predominantly Hyperactive-Impulsive Presentation";
      key = "hyperactive";
      description =
        "You endorsed enough hyperactive-impulsive symptoms to meet the DSM-5 threshold, without reaching it for the inattentive domain.";
    }

    return {
      inattCount,
      hyperCount,
      inattMet,
      hyperMet,
      subtype,
      description,
      key,
      threshold,
      partAShaded,
      partAPositive,
    };
  }, [answers, threshold]);

  function pick(value: number) {
    if (!currentQ) return;
    setAnswers((a) => ({ ...a, [currentQ.key]: value }));
    setPulse((p) => p + 1);
    // brief delay so the user sees the selection light up
    window.setTimeout(() => {
      setStep((s) => Math.min(s + 1, total));
    }, 240);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function skip() {
    setStep((s) => Math.min(s + 1, total));
  }

  function reset() {
    setAnswers({});
    setStep(0);
    setPhase("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Keyboard shortcuts: 1–5 to answer, ← back
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!started || submitted) return;
      if (e.key >= "1" && e.key <= "5") {
        pick(Number(e.key) - 1);
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        goBack();
      } else if (e.key === "ArrowRight") {
        skip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, submitted, step, currentQ?.key]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundBlobs />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)] sm:max-w-lg sm:px-6">
        {phase === "intro" ? (
          <Intro onStart={() => setPhase("onboarding")} />
        ) : phase === "onboarding" ? (
          <OnboardingStep
            initial={onboarding}
            onSubmit={(data: OnboardingData) => {
              setOnboarding(data);
              setPhase("quiz");
            }}
            onBack={() => setPhase("intro")}
          />
        ) : submitted ? (
          <Results result={result} onReset={reset} onboarding={onboarding} />
        ) : (
          <>
            <TopBar
              step={step}
              total={total}
              answered={answered}
              progress={progress}
              domain={currentQ!.domain}
            />
            <QuestionCard
              key={currentQ!.key}
              q={currentQ!}
              current={answers[currentQ!.key] ?? null}
              onPick={pick}
              pulse={pulse}
            />
            <NavBar
              step={step}
              total={total}
              answered={answered}
              onBack={goBack}
              onSkip={skip}
            />
          </>
        )}
      </div>
    </main>
  );
}

export function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-blob" />
      <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-blob [animation-delay:2s]" />
      <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-secondary/60 blur-3xl animate-blob [animation-delay:4s]" />
    </div>
  );
}

export function Intro({ onStart }: { onStart: () => void }) {
  const [ageInput, setAgeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const parsed = ageInput === "" ? NaN : Number(ageInput);
  const isValidAdult = Number.isFinite(parsed) && parsed >= 18 && parsed <= 120;

  function handleStart() {
    if (ageInput === "" || !Number.isFinite(parsed)) {
      setError("Please enter your age to continue.");
      return;
    }
    if (parsed < 18) {
      setError("Sorry — this app is only available to people aged 18 or over.");
      return;
    }
    if (parsed > 120) {
      setError("Please enter a realistic age.");
      return;
    }
    setError(null);
    onStart();
  }

  return (
    <div className="flex flex-1 flex-col items-start justify-center py-12 animate-fade-up">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
        WHO ASRS v1.1 · adult ADHD screener · UK
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
        How does your brain run?
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        18 short questions, one at a time. No long forms, no scrolling walls
        of text. Tap an answer or press <Kbd>1</Kbd>–<Kbd>5</Kbd> — you can
        change anything later. Aligned with NICE guideline NG87. For
        reflection — only a GP or NHS specialist can diagnose ADHD.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <label htmlFor="intro-age" className="block text-sm font-medium text-foreground">
          Your age
        </label>
        <input
          id="intro-age"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          value={ageInput}
          onChange={(e) => {
            setAgeInput(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleStart();
          }}
          placeholder="e.g. 23"
          aria-invalid={!!error}
          aria-describedby={error ? "intro-age-error" : "intro-age-help"}
          className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none ring-0 focus:border-primary"
        />
        <p id="intro-age-help" className="mt-2 text-xs text-muted-foreground">
          This app is for adults aged 18 and over.
        </p>
        {error && (
          <p id="intro-age-error" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleStart}
          disabled={!isValidAdult}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:translate-y-[-1px] hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Let's go
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
        <span className="text-sm text-muted-foreground">
          About 2 minutes · no sign-up
        </span>
      </div>
      <ul className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <Feature label="One question at a time" />
        <Feature label="Undo anytime" />
        <Feature label="Stays on your device" />
      </ul>
    </div>
  );
}

export function Feature({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span>{label}</span>
    </li>
  );
}

export function OnboardingStep({
  initial,
  onSubmit,
  onBack,
}: {
  initial: OnboardingData | null;
  onSubmit: (data: OnboardingData) => void;
  onBack: () => void;
}) {
  const [ageInput, setAgeInput] = useState(initial ? String(initial.age) : "");
  const [meds, setMeds] = useState<MedStatus | null>(initial?.meds ?? null);
  const [otherMeds, setOtherMeds] = useState<"yes" | "no" | "preferNot" | null>(
    initial?.otherMeds ?? null,
  );
  const [errors, setErrors] = useState<{ age?: string; meds?: string }>({});

  const OTHER_MED_OPTIONS: { value: "yes" | "no" | "preferNot"; label: string; hint: string }[] = [
    { value: "yes", label: "Yes", hint: "e.g. antidepressants, anxiety meds, pain relief" },
    { value: "no", label: "No", hint: "Not taking any other medication" },
    { value: "preferNot", label: "Prefer not to say", hint: "You can skip this" },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = OnboardingSchema.safeParse({
      age: ageInput === "" ? Number.NaN : Number(ageInput),
      meds: meds ?? undefined,
      otherMeds: otherMeds ?? undefined,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        age: flat.age?.[0],
        meds: flat.meds?.[0] ?? (meds ? undefined : "Pick one option"),
      });
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-1 flex-col justify-center py-10 animate-fade-up"
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
        Three quick questions
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Help us tailor your result
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        We use your age to set the right DSM-5 symptom threshold (6+ for
        under 17, 5+ for 17 and older), your ADHD medication status, and
        any other medicines you take to personalise today's tasks.
        Nothing leaves your device.
      </p>

      <div className="mt-8 space-y-7">
        <div>
          <label
            htmlFor="age"
            className="block text-sm font-medium text-foreground"
          >
            How old are you?
          </label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={5}
            max={120}
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
            placeholder="e.g. 28"
            className="mt-2 w-32 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            aria-invalid={!!errors.age}
            aria-describedby={errors.age ? "age-error" : undefined}
          />
          {errors.age && (
            <p id="age-error" className="mt-2 text-xs text-destructive">
              {errors.age}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-foreground">
            Are you on ADHD medication?
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MED_OPTIONS.map((opt) => {
              const selected = meds === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMeds(opt.value)}
                  className={
                    "rounded-2xl border px-4 py-3 text-left transition " +
                    (selected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/50")
                  }
                  aria-pressed={selected}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.meds && (
            <p className="mt-2 text-xs text-destructive">{errors.meds}</p>
          )}
        </fieldset>

        <fieldset>
          <legend className="block text-sm font-medium text-foreground">
            Are you taking any non-ADHD medication?
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {OTHER_MED_OPTIONS.map((opt) => {
              const selected = otherMeds === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOtherMeds(opt.value)}
                  className={
                    "rounded-2xl border px-4 py-3 text-left transition " +
                    (selected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/50")
                  }
                  aria-pressed={selected}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Back
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:translate-y-[-1px]"
        >
          Continue
          <span>→</span>
        </button>
      </div>
    </form>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-card px-1.5 text-xs font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function TopBar({
  step,
  total,
  answered,
  progress,
  domain,
}: {
  step: number;
  total: number;
  answered: number;
  progress: number;
  domain: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
          {domain}
        </span>
        <span>
          {step + 1} <span className="text-muted-foreground/60">/ {total}</span>
        </span>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              "h-1.5 flex-1 rounded-full transition-all duration-300 " +
              (i < step
                ? "bg-primary"
                : i === step
                  ? "bg-primary/60"
                  : "bg-muted")
            }
          />
        ))}
      </div>
      <div className="mt-2 text-right text-[11px] text-muted-foreground">
        {answered} answered · {progress}%
      </div>
    </div>
  );
}

export function QuestionCard({
  q,
  current,
  onPick,
  pulse,
}: {
  q: Q;
  current: number | null;
  onPick: (v: number) => void;
  pulse: number;
}) {
  return (
    <div
      key={q.key + pulse}
      className="flex-1 animate-fade-up"
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
        In the past 6 months… · no wrong answers
      </p>
      <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {q.text}
      </h2>

      <div className="mt-8 grid gap-2.5">
        {SCALE.map((s, idx) => {
          const selected = current === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onPick(s.value)}
              className={
                "group flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-150 " +
                (selected
                  ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.01]"
                  : "border-border bg-card hover:border-primary/50 hover:bg-card hover:translate-x-1 active:scale-[0.99]")
              }
            >
              <span
                className={
                  "flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition " +
                  (selected
                    ? "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground"
                    : "border-border bg-background text-muted-foreground group-hover:border-primary/50 group-hover:text-primary")
                }
              >
                {idx + 1}
              </span>
              <span className="flex-1">
                <span className="block text-base font-medium leading-tight">{s.label}</span>
                <span
                  className={
                    "block text-xs " +
                    (selected ? "text-primary-foreground/80" : "text-muted-foreground")
                  }
                >
                  {s.hint}
                </span>
              </span>
              <span
                className={
                  "text-xs uppercase tracking-wider transition-opacity " +
                  (selected ? "opacity-100" : "opacity-0 group-hover:opacity-60")
                }
              >
                {selected ? "Selected" : "Tap"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NavBar({
  step,
  total,
  answered,
  onBack,
  onSkip,
}: {
  step: number;
  total: number;
  answered: number;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-border pt-5 text-sm">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 0}
        className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
      >
        ← Back
      </button>
      <span className="text-xs text-muted-foreground">
        <Kbd>1</Kbd>–<Kbd>5</Kbd> to answer · <Kbd>←</Kbd> back
      </span>
      <button
        type="button"
        onClick={onSkip}
        disabled={step >= total - 1 && answered < total}
        className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
      >
        Skip →
      </button>
    </div>
  );
}

export function Results({
  result,
  onReset,
  onboarding,
}: {
  result: {
    inattCount: number;
    hyperCount: number;
    inattMet: boolean;
    hyperMet: boolean;
    subtype: string;
    description: string;
    key: "inattentive" | "hyperactive" | "combined" | "below";
    threshold: number;
    partAShaded: number;
    partAPositive: boolean;
  };
  onReset: () => void;
  onboarding: OnboardingData | null;
}) {
  const basePlan = TASKS[result.key];
  const medTask = onboarding ? MED_TASK[onboarding.meds] : null;
  const [history] = useCheckIns();
  const todayCheckIn = history.find((c) => c.date === todayISO()) ?? null;
  const adaptive = adaptiveTask(todayCheckIn);
  const planTasks: Task[] = [
    ...(adaptive ? [adaptive.task] : []),
    ...basePlan.tasks,
    ...(medTask ? [medTask] : []),
  ];
  const medLabel = onboarding
    ? MED_OPTIONS.find((m) => m.value === onboarding.meds)?.label
    : null;
  const adaptiveFp = adaptive ? adaptive.task.title.slice(0, 24) : "none";
  const storageKey = `adhd-tasks-${result.key}-${onboarding?.meds ?? "x"}-${adaptiveFp}-${new Date()
    .toISOString()
    .slice(0, 10)}`;
  const [done, setDone] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(done));
    }
  }, [done, storageKey]);
  const completed = Object.values(done).filter(Boolean).length;

  const [dashTab, setDashTab] = useState<"mood" | "tasks" | "coach">("mood");
  const dashTabs: { id: "mood" | "tasks" | "coach"; label: string; hint: string }[] = [
    { id: "mood", label: "Mood", hint: "Daily check-in" },
    { id: "tasks", label: "Tasks", hint: "Today's plan" },
    { id: "coach", label: "Coach", hint: "AI nudge" },
  ];

  return (
    <div className="space-y-8 py-8 animate-fade-up">
      <div
        className={
          "rounded-3xl border p-6 shadow-sm transition " +
          (result.partAPositive
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card")
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              ASRS v1.1 · Part A screener
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {result.partAPositive
                ? "Symptoms highly consistent with adult ADHD"
                : "Below the Part A screening threshold"}
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {result.partAShaded}
            </span>
            <span className="text-sm text-muted-foreground">/ 6 shaded</span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          The WHO-validated Part A screener (Kessler et al., 2005) flags scores
          of 4 or more "shaded" responses as warranting further assessment by
          a GP. This is not a diagnosis.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Your result
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {result.subtype}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          {result.description}
        </p>

        {onboarding && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
              Age {onboarding.age} · threshold {result.threshold}+
            </span>
            {medLabel && (
              <span className="rounded-full bg-accent/50 px-3 py-1 text-accent-foreground">
                {medLabel}
              </span>
            )}
            {onboarding.otherMeds === "yes" && (
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                Taking other medication
              </span>
            )}
            {onboarding.otherMeds === "preferNot" && (
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                Medication: prefer not to say
              </span>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <ScoreCard
            label="Inattention"
            count={result.inattCount}
            met={result.inattMet}
            threshold={result.threshold}
          />
          <ScoreCard
            label="Hyperactivity-Impulsivity"
            count={result.hyperCount}
            met={result.hyperMet}
            threshold={result.threshold}
          />
        </div>
      </div>

      <MoodReminderBanner />

      <section className="rounded-3xl border border-border bg-card/60 p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Your dashboard
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">
              Daily tools
            </h3>
          </div>
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium"
          >
            {dashTabs.map((t) => {
              const active = dashTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setDashTab(t.id)}
                  className={
                    "rounded-full px-3 py-1.5 transition " +
                    (active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-6">
          {dashTab === "mood" && (
            <>
              <MoodCard />
              <CheckInCard />
            </>
          )}

          {dashTab === "coach" && <NudgeCard subtype={result.subtype} />}

          {dashTab === "tasks" && (
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Today's plan
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {basePlan.headline}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick just <strong className="font-semibold text-foreground">one</strong> to try today. Small wins count — you can come back tomorrow.
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {completed}/{planTasks.length} done
          </div>
        </div>

        {adaptive && (
          <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              Adapting to today's check-in
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {adaptive.reason}
            </p>
          </div>
        )}
        {!adaptive && (
          <p className="mt-5 text-xs text-muted-foreground">
            Log today's mood in the Mood tab and this plan will adapt to how
            you actually feel right now.
          </p>
        )}

        <ul className="mt-6 space-y-2.5">
          {planTasks.map((t, i) => {
            const checked = !!done[i];
            const isAdaptive = !!adaptive && i === 0;
            const isMed = !!medTask && i === planTasks.length - 1;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                  className={
                    "group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition " +
                    (checked
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background hover:border-primary/40")
                  }
                >
                  <span
                    className={
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition " +
                      (checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-transparent group-hover:border-primary/50")
                    }
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="flex-1">
                    {isAdaptive && (
                      <span className="mb-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                        Adapted to today
                      </span>
                    )}
                    {isMed && (
                      <span className="mb-1 inline-block rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
                        Medication-tailored
                      </span>
                    )}
                    <span
                      className={
                        "block text-[15px] font-medium leading-snug " +
                        (checked ? "text-muted-foreground line-through" : "text-foreground")
                      }
                    >
                      {t.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {t.why}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Drawn from CBT for adult ADHD (Safren et al., 2005/2010), Barkley's
          executive-function framework (2012), NICE guideline NG87, and ADHD
          UK / ADHD Foundation resources. These are self-management strategies,
          not a treatment plan — your GP or an NHS ADHD service can
          personalise them.
        </p>
      </div>
          )}
        </div>
      </section>

      <NhsNextSteps partAPositive={result.partAPositive} />

      <div className="rounded-2xl bg-accent/40 p-6 text-sm leading-relaxed text-accent-foreground">
        <strong className="font-semibold">How this is scored.</strong> Items
        come from the WHO Adult ADHD Self-Report Scale (ASRS v1.1, Kessler et
        al., 2005). Part A (items 1–6) is the validated 6-item screener with
        item-specific "shaded" thresholds — 4 or more shaded answers indicates
        symptoms highly consistent with adult ADHD. All 18 items also map to
        DSM-5 inattentive and hyperactive-impulsive symptom counts; your
        threshold of <strong>{result.threshold}+</strong> reflects the DSM-5
        age rule (6+ under 17, 5+ for 17 and older). NICE guideline NG87 is
        the UK standard for ADHD assessment and care. A diagnosis also
        requires onset before age 12, symptoms in 2+ settings, and
        clinically significant impairment — only a GP or NHS specialist
        (typically a psychiatrist or specialist ADHD service) can establish
        that.
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-90"
        >
          Retake the quiz
        </button>
      </div>
      <p className="pt-6 text-xs leading-relaxed text-muted-foreground">
        For educational use only and not a substitute for NHS clinical
        assessment. If you're in distress, call NHS 111 (or 999 in an
        emergency). For mental health support, contact the Samaritans on
        116 123.
      </p>
    </div>
  );
}

export function ScoreCard({
  label,
  count,
  met,
  threshold,
}: {
  label: string;
  count: number;
  met: boolean;
  threshold: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">{count}</span>
        <span className="text-sm text-muted-foreground">/ 9 symptoms</span>
      </div>
      <p
        className={
          "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium " +
          (met
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground")
        }
      >
        {met ? `Threshold met (${threshold}+)` : `Below threshold (${threshold}+)`}
      </p>
    </div>
  );
}

export function entryAvg(c: CheckIn): number {
  const vals = [c.mood, c.focus ?? undefined, c.energy ?? undefined].filter(
    (v): v is number => typeof v === "number",
  );
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export function MoodReminderBanner() {
  const [history] = useCheckIns();
  const todays = history.find((c) => c.date === todayISO());
  if (todays) return null;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
      You haven't logged your mood today. It takes about ten seconds.
    </div>
  );
}

export function MoodCard() {
  const [history, setHistory] = useCheckIns();
  const today = todayISO();
  const todays = history.find((c) => c.date === today) ?? null;

  const [mood, setMood] = useState<number | null>(todays?.mood ?? null);
  const [tags, setTags] = useState<string[]>(todays?.tags ?? []);

  // Re-sync local state if storage updates from elsewhere (e.g. CheckInCard)
  useEffect(() => {
    setMood(todays?.mood ?? null);
    setTags(todays?.tags ?? []);
  }, [todays?.mood, todays?.tags?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(nextMood: number, nextTags: string[]) {
    const merged: CheckIn = {
      date: today,
      mood: nextMood,
      focus: todays?.focus ?? null,
      energy: todays?.energy ?? null,
      tags: nextTags.length ? nextTags : undefined,
      note: todays?.note,
    };
    const parsed = CheckInSchema.safeParse(merged);
    if (!parsed.success) return;
    const next = [
      ...history.filter((c) => c.date !== today),
      parsed.data,
    ].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(next);
  }

  function pickMood(v: number) {
    setMood(v);
    commit(v, tags);
  }

  function toggleTag(t: string) {
    const has = tags.includes(t);
    const next = has ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 8);
    setTags(next);
    if (mood) commit(mood, next);
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Mood today
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            One tap. That's it.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Log how you feel right now. Add a focus and energy rating below if
            you've got a minute.
          </p>
        </div>
        {mood && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Logged · {MOOD_LABELS[mood - 1]}
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-5 gap-1.5">
        {MOOD_LABELS.map((word, i) => {
          const v = i + 1;
          const selected = mood === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => pickMood(v)}
              aria-label={`Mood: ${word}`}
              className={
                "flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 transition " +
                (selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-background hover:border-primary/50")
              }
            >
              <span className="text-base font-semibold text-foreground">{v}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">{word}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          What fits? (optional)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
                  (on
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50")
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CheckInCard() {
  const [history, setHistory] = useCheckIns();
  const today = todayISO();
  const todays = history.find((c) => c.date === today) ?? null;

  const [focus, setFocus] = useState<number | null>(todays?.focus ?? null);
  const [energy, setEnergy] = useState<number | null>(todays?.energy ?? null);
  const [note, setNote] = useState<string>(todays?.note ?? "");
  const [saved, setSaved] = useState<boolean>(
    !!(todays?.focus && todays?.energy),
  );
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    setFocus(todays?.focus ?? null);
    setEnergy(todays?.energy ?? null);
    setNote(todays?.note ?? "");
    setSaved(!!(todays?.focus && todays?.energy));
  }, [todays?.focus, todays?.energy, todays?.note]);

  function save() {
    if (!todays?.mood) {
      setErr("Tap a mood above first.");
      return;
    }
    if (!focus || !energy) {
      setErr("Pick a rating for focus and energy.");
      return;
    }
    setErr(null);
    const merged: CheckIn = {
      date: today,
      mood: todays.mood,
      focus,
      energy,
      tags: todays.tags,
      note: note.trim() || undefined,
    };
    const parsed = CheckInSchema.safeParse(merged);
    if (!parsed.success) {
      setErr("Something looked off — please try again.");
      return;
    }
    const next = [
      ...history.filter((c) => c.date !== today),
      parsed.data,
    ].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(next);
    setSaved(true);
  }

  function edit() {
    setSaved(false);
  }

  const days: (CheckIn | null)[] = useMemo(() => {
    const out: (CheckIn | null)[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push(history.find((c) => c.date === iso) ?? null);
    }
    return out;
  }, [history, range]);

  const logged = days.filter(Boolean) as CheckIn[];
  const avgMood = logged.length
    ? logged.reduce((s, c) => s + c.mood, 0) / logged.length
    : 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Focus &amp; energy
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Round out today's check-in
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tracking these alongside mood helps you and any clinician spot
            patterns over time (NICE NG87).
          </p>
        </div>
        {saved && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Logged today
          </span>
        )}
      </div>

      {!saved ? (
        <div className="mt-6 space-y-5">
          <Scale
            label="Focus"
            labels={FOCUS_LABELS}
            value={focus}
            onChange={setFocus}
          />
          <Scale
            label="Energy"
            labels={ENERGY_LABELS}
            value={energy}
            onChange={setEnergy}
          />

          <div>
            <label htmlFor="note" className="block text-sm font-medium text-foreground">
              Note (optional)
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="One sentence about today…"
              className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              maxLength={280}
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">
              {note.length}/280
            </div>
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-90"
            >
              Save check-in
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {todays?.mood && (
            <Summary label="Mood" word={MOOD_LABELS[todays.mood - 1]} value={todays.mood} />
          )}
          {todays?.focus && (
            <Summary label="Focus" word={FOCUS_LABELS[todays.focus - 1]} value={todays.focus} />
          )}
          {todays?.energy && (
            <Summary label="Energy" word={ENERGY_LABELS[todays.energy - 1]} value={todays.energy} />
          )}
          {todays?.tags && todays.tags.length > 0 && (
            <div className="sm:col-span-3 flex flex-wrap gap-1.5">
              {todays.tags.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
          {todays?.note && (
            <p className="sm:col-span-3 rounded-xl bg-background p-3 text-sm italic text-muted-foreground">
              "{todays.note}"
            </p>
          )}
          <div className="sm:col-span-3 flex justify-end">
            <button
              type="button"
              onClick={edit}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Edit today's check-in
            </button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Mood trend · {logged.length}/{range} days
            {logged.length > 0 && (
              <span className="ml-2 normal-case tracking-normal text-foreground">
                avg {avgMood.toFixed(1)}
              </span>
            )}
          </p>
          <div className="flex gap-1">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r as 7 | 30 | 90)}
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition " +
                  (range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70")
                }
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${range}, minmax(0, 1fr))` }}
        >
          {days.map((c, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (range - 1 - i));
            const iso = d.toISOString().slice(0, 10);
            const moodVal = c?.mood ?? 0;
            const avg = c ? entryAvg(c) : 0;
            const title = c
              ? `${iso} · Mood ${c.mood}${c.focus ? ` · Focus ${c.focus}` : ""}${c.energy ? ` · Energy ${c.energy}` : ""}${c.tags?.length ? ` · ${c.tags.join(", ")}` : ""}`
              : `${iso} · no entry`;
            return (
              <div
                key={i}
                className="flex h-14 w-full items-end overflow-hidden rounded-md bg-muted/50"
                title={title}
              >
                {c ? (
                  <div
                    className="w-full rounded-md bg-primary/70 transition-all"
                    style={{
                      height: `${(Math.max(moodVal, avg) / 5) * 100}%`,
                      opacity: 0.5 + (moodVal / 5) * 0.5,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Scale({
  label,
  labels,
  value,
  onChange,
}: {
  label: string;
  labels: string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {value ? labels[value - 1] : "Pick one"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {labels.map((word, i) => {
          const v = i + 1;
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-label={`${label}: ${word}`}
              className={
                "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 transition " +
                (selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/50")
              }
            >
              <span className="text-sm font-semibold text-foreground">{v}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">{word}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Summary({
  label,
  word,
  value,
}: {
  label: string;
  word: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <div className="text-base font-semibold text-foreground">{word}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs text-muted-foreground">{value}/5</div>
    </div>
  );
}

export function NhsNextSteps({ partAPositive }: { partAPositive: boolean }) {
  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        NHS next steps · UK
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">
        {partAPositive
          ? "Worth talking to your GP"
          : "If symptoms still affect your day"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This screener can't diagnose ADHD, but you can take your results to
        your GP. They can refer you to an NHS adult ADHD assessment service.
        Waiting lists can be long — under <strong className="text-foreground">NHS
        Right to Choose</strong> (England), you can usually ask to be referred
        to a provider with a shorter wait.
      </p>
      <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <NhsLink
          href="https://www.nhs.uk/conditions/attention-deficit-hyperactivity-disorder-adhd/"
          title="ADHD on NHS.uk"
          hint="Overview, symptoms, treatment"
        />
        <NhsLink
          href="https://www.nhs.uk/service-search/find-a-gp"
          title="Find a GP"
          hint="Register or book an appointment"
        />
        <NhsLink
          href="https://www.nice.org.uk/guidance/ng87"
          title="NICE guideline NG87"
          hint="UK standard for ADHD care"
        />
        <NhsLink
          href="https://adhduk.co.uk/right-to-choose/"
          title="Right to Choose (ADHD UK)"
          hint="Shorter NHS waiting lists in England"
        />
      </ul>
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        In a crisis call <strong className="text-foreground">NHS 111</strong>{" "}
        (option 2 for mental health) or <strong className="text-foreground">999</strong>{" "}
        if life is at risk. Samaritans: <strong className="text-foreground">116 123</strong>, free, 24/7.
      </p>
    </div>
  );
}

export function NhsLink({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-2xl border border-border bg-background p-3 transition hover:border-primary/50"
      >
        <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">
            {title}
            <span className="ml-1 text-muted-foreground transition group-hover:text-primary">↗</span>
          </span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </a>
    </li>
  );
}

type Nudge = {
  task: string;
  firstStepBullets: string[];
  timeEstimate: string;
  encouragement: string;
};
type Coach = {
  approachBullets: string[];
  firstStepBullets: string[];
  timeEstimate: string;
  pitfallBullets: string[];
  ifStuckBullets: string[];
  reference: string;
};

export function NudgeCard({ subtype }: { subtype: string }) {
  const NUDGE_TASKS_KEY = "adhd-nudge-tasks-v1";
  const [tasks, setTasks] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(localStorage.getItem(NUDGE_TASKS_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((t) => typeof t === "string") : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<Record<string, Coach>>({});
  const [coachLoading, setCoachLoading] = useState<string | null>(null);
  const [coachErr, setCoachErr] = useState<Record<string, string>>({});
  const [openCoach, setOpenCoach] = useState<Record<string, boolean>>({});
  const ask = useServerFn(suggestNudge);
  const coach = useServerFn(coachTask);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(NUDGE_TASKS_KEY, JSON.stringify(tasks));
    }
  }, [tasks]);

  function addTask() {
    const t = draft.trim();
    if (!t) return;
    setTasks((arr) => [...arr, t].slice(0, 12));
    setDraft("");
  }

  function removeTask(i: number) {
    setTasks((arr) => arr.filter((_, idx) => idx !== i));
    setCoaches((c) => {
      const next = { ...c };
      delete next[tasks[i]];
      return next;
    });
  }

  async function coachOne(task: string) {
    setCoachLoading(task);
    setCoachErr((e) => ({ ...e, [task]: "" }));
    try {
      const today = loadCheckIns().find((c) => c.date === todayISO()) ?? null;
      const result = await coach({
        data: {
          task,
          mood: today?.mood ?? null,
          focus: today?.focus ?? null,
          energy: today?.energy ?? null,
          subtype,
        },
      });
      setCoaches((c) => ({ ...c, [task]: result as Coach }));
      setOpenCoach((o) => ({ ...o, [task]: true }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const friendly = msg.includes("429")
        ? "Lots of requests right now — try again in a moment."
        : msg.includes("402")
          ? "AI credits ran out. Top up in workspace settings."
          : "Couldn't get advice. Try again?";
      setCoachErr((e) => ({ ...e, [task]: friendly }));
    } finally {
      setCoachLoading(null);
    }
  }

  async function suggest() {
    if (tasks.length === 0) return;
    setLoading(true);
    setErr(null);
    try {
      const today = loadCheckIns().find((c) => c.date === todayISO()) ?? null;
      const result = await ask({
        data: {
          mood: today?.mood ?? null,
          focus: today?.focus ?? null,
          energy: today?.energy ?? null,
          subtype,
          tasks,
        },
      });
      setNudge(result as Nudge);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if (msg.includes("429")) setErr("Lots of requests right now — try again in a moment.");
      else if (msg.includes("402")) setErr("AI credits ran out. Top up in workspace settings.");
      else setErr("Couldn't get a nudge. Try again?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        AI nudge
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">
        What's the next small thing?
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Hand it your mood and task list. It picks one and breaks it into a
        first step you can finish in five minutes.
      </p>

      <div className="mt-5">
        <label htmlFor="nudge-task" className="sr-only">
          Add a task
        </label>
        <div className="flex gap-2">
          <input
            id="nudge-task"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTask();
              }
            }}
            placeholder="e.g. Reply to landlord email"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={addTask}
            disabled={!draft.trim()}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {tasks.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {tasks.map((t, i) => {
              const c = coaches[t];
              const open = !!openCoach[t];
              const isLoading = coachLoading === t;
              const tErr = coachErr[t];
              return (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-background/60"
                >
                  <div className="flex items-start gap-2 px-3 py-2">
                    <span className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-foreground">{t}</span>
                    <button
                      type="button"
                      onClick={() => removeTask(i)}
                      aria-label={`Remove ${t}`}
                      className="rounded-md px-2 text-xs text-muted-foreground transition hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        c
                          ? setOpenCoach((o) => ({ ...o, [t]: !o[t] }))
                          : coachOne(t)
                      }
                      disabled={isLoading}
                      className="text-xs font-medium text-primary transition hover:opacity-80 disabled:opacity-50"
                    >
                      {isLoading
                        ? "Coaching…"
                        : c
                          ? open
                            ? "Hide advice"
                            : "Show advice"
                          : "How should I approach this?"}
                    </button>
                    {c && (
                      <button
                        type="button"
                        onClick={() => coachOne(t)}
                        disabled={isLoading}
                        className="text-[11px] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                  {tErr && (
                    <p className="px-3 pb-2 text-xs text-destructive">{tErr}</p>
                  )}
                  {c && open && (
                    <div className="space-y-3 border-t border-border/60 bg-primary/[0.04] px-3 py-3 text-sm">
                      <CoachBullets label="Approach" items={c.approachBullets} />
                      <CoachBullets
                        label="First step"
                        items={c.firstStepBullets}
                        highlight
                        timeEstimate={c.timeEstimate}
                      />
                      <CoachBullets label="Watch out for" items={c.pitfallBullets} />
                      <CoachBullets label="If you get stuck" items={c.ifStuckBullets} />
                      {c.reference && (
                        <p className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Based on {c.reference}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Add a couple of tasks above, then ask for a nudge.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={suggest}
        disabled={loading || tasks.length === 0}
        className="mt-5 w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Thinking…" : "Suggest my next step"}
      </button>
      {err && <p className="mt-3 text-xs text-destructive">{err}</p>}

      {nudge && (
        <div className="mt-5 rounded-2xl border border-primary/30 bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
              Start here
            </p>
            {nudge.timeEstimate && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                ⏱ {nudge.timeEstimate}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{nudge.task}</p>
          {nudge.firstStepBullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 rounded-xl bg-primary/10 px-3 py-2.5 text-sm leading-snug text-foreground">
              {nudge.firstStepBullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs italic text-muted-foreground">
            {nudge.encouragement}
          </p>
        </div>
      )}
    </div>
  );
}

export function CoachBullets({
  label,
  items,
  highlight,
  timeEstimate,
}: {
  label: string;
  items: string[];
  highlight?: boolean;
  timeEstimate?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {timeEstimate && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
            ⏱ {timeEstimate}
          </span>
        )}
      </div>
      <ul
        className={
          "mt-1 space-y-1 text-sm leading-snug text-foreground " +
          (highlight ? "rounded-lg bg-primary/10 px-2 py-1.5 font-medium" : "")
        }
      >
        {items.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Onboarding result persistence ----
export const ONBOARDING_KEY = "adhd-onboarding-result-v1";
export const ONBOARDED_FLAG = "adhd-onboarded-v1";

export type ResultPayload = {
  inattCount: number;
  hyperCount: number;
  inattMet: boolean;
  hyperMet: boolean;
  subtype: string;
  description: string;
  key: "inattentive" | "hyperactive" | "combined" | "below";
  threshold: number;
  partAShaded: number;
  partAPositive: boolean;
};

export type StoredOnboarding = {
  onboarding: OnboardingData;
  result: ResultPayload;
  completedAt: string;
  answers?: Answers;
};

export function loadOnboardingResult(): StoredOnboarding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredOnboarding;
  } catch {
    return null;
  }
}

export function saveOnboardingResult(p: StoredOnboarding) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(p));
  localStorage.setItem(ONBOARDED_FLAG, "1");
  window.dispatchEvent(new CustomEvent("adhd-onboarding-changed"));
}

export function clearOnboarding() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(ONBOARDED_FLAG);
  window.dispatchEvent(new CustomEvent("adhd-onboarding-changed"));
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDED_FLAG) === "1";
}

export function useOnboardingResult(): StoredOnboarding | null {
  const [v, setV] = useState<StoredOnboarding | null>(() => loadOnboardingResult());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setV(loadOnboardingResult());
    window.addEventListener("adhd-onboarding-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("adhd-onboarding-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return v;
}

// Plain-English psychoeducation by ASRS-mapped subtype. Sourced from
// NICE NG87, Safren CBT-ADHD modules, and Barkley (2012).
export const PSYCHOED: Record<
  "inattentive" | "hyperactive" | "combined" | "below",
  { title: string; tagline: string; body: string[]; refs: string }
> = {
  inattentive: {
    title: "Predominantly Inattentive",
    tagline: "Attention, working memory and follow-through carry most of the load.",
    body: [
      "You're more likely to lose track of details, drift off mid-task, and forget commitments — not because you don't care, but because the brain's attention-control system is under-firing.",
      "What helps: externalise everything (single inbox, written priorities), shorten the gap between intention and action (timers, body-doubling), and reduce decision load in the morning.",
    ],
    refs: "Safren CBT-ADHD · Barkley 2012 · NICE NG87",
  },
  hyperactive: {
    title: "Predominantly Hyperactive-Impulsive",
    tagline: "Restlessness and impulsivity show up more than inattention.",
    body: [
      "You're more likely to act before thinking, interrupt, fidget, or feel driven by an internal motor. Suppressing it usually backfires — channelling it works better.",
      "What helps: daily movement, structured breaks, a 10-second pause before sending or saying yes, and protected wind-down time so sleep doesn't amplify impulsivity the next day.",
    ],
    refs: "CHADD · Barkley 2012 · NICE NG87",
  },
  combined: {
    title: "Combined Presentation",
    tagline: "Both inattention and hyperactivity-impulsivity meet threshold.",
    body: [
      "You get the attention-regulation challenges and the impulsivity/restlessness challenges. Plans need to support both — protect attention AND give the body an outlet.",
      "What helps: move first, then plan; time-box work in 25/5 cycles; keep a 'parking lot' for stray thoughts; pause before commitments.",
    ],
    refs: "Safren CBT-ADHD · Barkley 2012 · NICE NG87",
  },
  below: {
    title: "Below the DSM-5 symptom threshold",
    tagline: "Your responses don't meet the DSM-5 symptom count for ADHD.",
    body: [
      "Symptoms can still affect day-to-day life even below threshold. Tracking mood and using the executive-function tools in this app may still help.",
      "If symptoms cause distress or impairment, your GP can refer you for a full NHS assessment under NICE NG87.",
    ],
    refs: "NICE NG87",
  },
};
