import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adult ADHD Self-Screener (UK) — WHO ASRS v1.1" },
      { name: "description", content: "Free adult ADHD self-screener for the UK, based on the WHO ASRS v1.1 and NICE guideline NG87. Includes signposting to your GP and NHS services. Not a diagnosis." },
      { property: "og:title", content: "Adult ADHD Self-Screener (UK) — WHO ASRS v1.1" },
      { property: "og:description", content: "WHO ASRS v1.1 adult ADHD screener with NICE NG87-aligned guidance and NHS signposting." },
    ],
  }),
  component: Index,
});

// WHO Adult ADHD Self-Report Scale (ASRS v1.1) — Kessler et al., 2005.
// The 18-item adult-worded version of the DSM criteria. Items 1–6 form the
// validated Part A screener; 4+ "shaded" responses indicates symptoms
// highly consistent with adult ADHD. All 18 items map to the inattention
// or hyperactive/impulsive domain for subtype scoring.
type Domain = "Inattention" | "Hyperactivity & Impulsivity";

type AsrsItem = {
  num: number;            // official ASRS item number (1–18)
  text: string;           // item wording
  domain: Domain;         // for DSM subtype scoring
  partA: boolean;         // belongs to the validated 6-item screener
  shadeFrom?: 2 | 3;      // Part A only: lowest "shaded" response value
};

const ASRS: AsrsItem[] = [
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

const SCALE = [
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
const COUNT_THRESHOLD = 3;

type MedStatus = "none" | "considering" | "current" | "former";

const MED_OPTIONS: { value: MedStatus; label: string; hint: string }[] = [
  { value: "none", label: "Not on medication", hint: "Never been prescribed" },
  { value: "considering", label: "Considering / pending eval", hint: "Looking into it" },
  { value: "current", label: "Currently taking", hint: "Stimulant or non-stimulant" },
  { value: "former", label: "Took it previously", hint: "Not currently on it" },
];

// Zod schema validates the onboarding payload on the client before we use
// it to set thresholds and tailor tasks.
const OnboardingSchema = z.object({
  age: z
    .number({ invalid_type_error: "Enter your age as a number" })
    .int("Enter a whole number")
    .min(5, "Must be 5 or older")
    .max(120, "Enter a realistic age"),
  meds: z.enum(["none", "considering", "current", "former"]),
});
type OnboardingData = z.infer<typeof OnboardingSchema>;

type Answers = Record<string, number | null>;

type Q = { key: string; text: string; domain: Domain; partA: boolean };

// ----- Daily check-in -----
const CheckInSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  mood: z.number().int().min(1).max(5),
  focus: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  note: z.string().trim().max(280).optional(),
});
type CheckIn = z.infer<typeof CheckInSchema>;

const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"];
const FOCUS_LABELS = ["Scattered", "Foggy", "Okay", "Locked in", "Laser"];
const ENERGY_LABELS = ["Empty", "Tired", "Steady", "Charged", "Buzzing"];

const CHECKIN_KEY = "adhd-checkins-v1";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadCheckIns(): CheckIn[] {
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

function saveCheckIns(list: CheckIn[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(list));
}

// Present items in their official ASRS order (Part A first).
const QUESTIONS: Q[] = ASRS.map((it) => ({
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
type Task = { title: string; why: string };

const TASKS: Record<
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
const MED_TASK: Record<MedStatus, Task | null> = {
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

function ageThreshold(age: number) {
  // DSM-5: 6+ symptoms for under 17, 5+ for 17 and older
  return age < 17 ? 6 : 5;
}

function Index() {
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
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8 sm:py-12">
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

function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-blob" />
      <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-blob [animation-delay:2s]" />
      <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-secondary/60 blur-3xl animate-blob [animation-delay:4s]" />
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
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
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={onStart}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:translate-y-[-1px] hover:shadow-primary/30"
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

function Feature({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span>{label}</span>
    </li>
  );
}

function OnboardingStep({
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
  const [errors, setErrors] = useState<{ age?: string; meds?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = OnboardingSchema.safeParse({
      age: ageInput === "" ? Number.NaN : Number(ageInput),
      meds: meds ?? undefined,
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
        Two quick questions
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Help us tailor your result
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        We use your age to set the right DSM-5 symptom threshold (6+ for
        under 17, 5+ for 17 and older) and your medication status to
        personalise today's tasks. Nothing leaves your device.
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-card px-1.5 text-xs font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

function TopBar({
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

function QuestionCard({
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

function NavBar({
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

function Results({
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
  const planTasks = medTask ? [...basePlan.tasks, medTask] : basePlan.tasks;
  const medLabel = onboarding
    ? MED_OPTIONS.find((m) => m.value === onboarding.meds)?.label
    : null;
  const storageKey = `adhd-tasks-${result.key}-${onboarding?.meds ?? "x"}-${new Date()
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

      <CheckInCard />

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

        <ul className="mt-6 space-y-2.5">
          {planTasks.map((t, i) => {
            const checked = !!done[i];
            const isMed = medTask && i === planTasks.length - 1;
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

function ScoreCard({
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

function CheckInCard() {
  const [history, setHistory] = useState<CheckIn[]>(() => loadCheckIns());
  const today = todayISO();
  const todays = history.find((c) => c.date === today) ?? null;

  const [mood, setMood] = useState<number | null>(todays?.mood ?? null);
  const [focus, setFocus] = useState<number | null>(todays?.focus ?? null);
  const [energy, setEnergy] = useState<number | null>(todays?.energy ?? null);
  const [note, setNote] = useState<string>(todays?.note ?? "");
  const [saved, setSaved] = useState(!!todays);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    const parsed = CheckInSchema.safeParse({
      date: today,
      mood,
      focus,
      energy,
      note: note.trim() || undefined,
    });
    if (!parsed.success) {
      setErr("Pick a rating for mood, focus, and energy.");
      return;
    }
    setErr(null);
    const next = [
      ...history.filter((c) => c.date !== today),
      parsed.data,
    ].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(next);
    saveCheckIns(next);
    setSaved(true);
  }

  function edit() {
    setSaved(false);
  }

  // Last 7 days for the trend strip
  const last7: (CheckIn | null)[] = useMemo(() => {
    const out: (CheckIn | null)[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push(history.find((c) => c.date === iso) ?? null);
    }
    return out;
  }, [history]);

  return (
    <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Daily check-in
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            How is today going?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            One snapshot a day. Tracking mood and symptoms over time helps you
            and any clinician spot patterns (NICE NG87).
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
            label="Mood"
            labels={MOOD_LABELS}
            value={mood}
            onChange={setMood}
          />
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
            <label
              htmlFor="note"
              className="block text-sm font-medium text-foreground"
            >
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
          <Summary label="Mood" word={MOOD_LABELS[(todays?.mood ?? mood ?? 1) - 1]} value={todays?.mood ?? mood!} />
          <Summary label="Focus" word={FOCUS_LABELS[(todays?.focus ?? focus ?? 1) - 1]} value={todays?.focus ?? focus!} />
          <Summary label="Energy" word={ENERGY_LABELS[(todays?.energy ?? energy ?? 1) - 1]} value={todays?.energy ?? energy!} />
          {(todays?.note || note) && (
            <p className="sm:col-span-3 rounded-xl bg-background p-3 text-sm italic text-muted-foreground">
              “{todays?.note ?? note}”
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
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Last 7 days
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {last7.map((c, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const day = d.toLocaleDateString(undefined, { weekday: "narrow" });
            const avg = c ? (c.mood + c.focus + c.energy) / 3 : 0;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end overflow-hidden rounded-lg bg-muted/60">
                  {c ? (
                    <div
                      className="w-full rounded-lg bg-primary/70 transition-all"
                      style={{ height: `${(avg / 5) * 100}%` }}
                      title={`Mood ${c.mood} · Focus ${c.focus} · Energy ${c.energy}`}
                    />
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground">{day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Scale({
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

function Summary({
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

function NhsNextSteps({ partAPositive }: { partAPositive: boolean }) {
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

function NhsLink({
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
