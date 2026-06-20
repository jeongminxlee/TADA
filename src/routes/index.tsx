import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADHD Self-Screener — DSM-5 Subtypes" },
      { name: "description", content: "An informational self-screening questionnaire based on the DSM-5 criteria for ADHD subtypes. Not a diagnosis." },
      { property: "og:title", content: "ADHD Self-Screener — DSM-5 Subtypes" },
      { property: "og:description", content: "Reflect on inattentive and hyperactive-impulsive symptoms using DSM-5 criteria." },
    ],
  }),
  component: Index,
});

const INATTENTION = [
  "Often fails to give close attention to details or makes careless mistakes",
  "Often has difficulty sustaining attention in tasks or play",
  "Often does not seem to listen when spoken to directly",
  "Often does not follow through on instructions and fails to finish tasks",
  "Often has difficulty organizing tasks and activities",
  "Often avoids or dislikes tasks that require sustained mental effort",
  "Often loses things necessary for tasks or activities",
  "Is often easily distracted by extraneous stimuli or unrelated thoughts",
  "Is often forgetful in daily activities",
];

const HYPERACTIVITY = [
  "Often fidgets with or taps hands or feet, or squirms in seat",
  "Often leaves seat in situations when remaining seated is expected",
  "Often runs about or feels restless in situations where it is inappropriate",
  "Often unable to play or engage in leisure activities quietly",
  "Is often 'on the go' acting as if 'driven by a motor'",
  "Often talks excessively",
  "Often blurts out an answer before a question has been completed",
  "Often has difficulty waiting their turn",
  "Often interrupts or intrudes on others",
];

const SCALE = [
  { label: "Never", emoji: "😌", value: 0 },
  { label: "Rarely", emoji: "🙂", value: 1 },
  { label: "Sometimes", emoji: "🤔", value: 2 },
  { label: "Often", emoji: "😅", value: 3 },
  { label: "Very often", emoji: "🔥", value: 4 },
];

// Per DSM-5, a symptom "counts" toward the subtype threshold if it occurs
// often or very often (>= 3 on this 0–4 scale).
const COUNT_THRESHOLD = 3;
const ADULT_SYMPTOM_THRESHOLD = 5; // 5+ for adolescents 17+/adults; 6+ for children

type Answers = Record<string, number | null>;

type Q = { key: string; prefix: "I" | "H"; text: string; domain: string };

const QUESTIONS: Q[] = [
  ...INATTENTION.map((text, i) => ({
    key: `I${i}`,
    prefix: "I" as const,
    text,
    domain: "Inattention",
  })),
  ...HYPERACTIVITY.map((text, i) => ({
    key: `H${i}`,
    prefix: "H" as const,
    text,
    domain: "Hyperactivity & Impulsivity",
  })),
];

function Index() {
  const total = QUESTIONS.length;
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0); // 0..total-1 = questions, total = results, -1 = intro
  const [started, setStarted] = useState(false);
  const [pulse, setPulse] = useState(0);

  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const submitted = started && step >= total;
  const currentQ = !submitted && started ? QUESTIONS[step] : null;
  const progress = Math.round((answered / total) * 100);

  const result = useMemo(() => {
    const inattCount = INATTENTION.filter(
      (_, i) => (answers[`I${i}`] ?? -1) >= COUNT_THRESHOLD,
    ).length;
    const hyperCount = HYPERACTIVITY.filter(
      (_, i) => (answers[`H${i}`] ?? -1) >= COUNT_THRESHOLD,
    ).length;

    const inattMet = inattCount >= ADULT_SYMPTOM_THRESHOLD;
    const hyperMet = hyperCount >= ADULT_SYMPTOM_THRESHOLD;

    let subtype = "Below DSM-5 symptom threshold";
    let description =
      "Your responses don't reach the DSM-5 symptom threshold for an ADHD presentation. Symptoms may still affect you — consider speaking with a clinician if they cause distress or impairment.";
    if (inattMet && hyperMet) {
      subtype = "Combined Presentation";
      description =
        "You endorsed enough symptoms in both the inattentive and the hyperactive-impulsive domains to meet the DSM-5 symptom threshold for the Combined Presentation.";
    } else if (inattMet) {
      subtype = "Predominantly Inattentive Presentation";
      description =
        "You endorsed enough inattentive symptoms to meet the DSM-5 threshold, without reaching it for the hyperactive-impulsive domain.";
    } else if (hyperMet) {
      subtype = "Predominantly Hyperactive-Impulsive Presentation";
      description =
        "You endorsed enough hyperactive-impulsive symptoms to meet the DSM-5 threshold, without reaching it for the inattentive domain.";
    }

    return { inattCount, hyperCount, inattMet, hyperMet, subtype, description };
  }, [answers]);

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
    setStarted(true);
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
        {!started ? (
          <Intro onStart={() => setStarted(true)} />
        ) : submitted ? (
          <Results result={result} onReset={reset} />
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
        DSM-5 self-screener
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
        How does your brain run?
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        18 quick questions, one at a time. Use the buttons, tap a number key
        <Kbd>1</Kbd>–<Kbd>5</Kbd>, or arrow back if you change your mind. Built
        around the DSM-5 criteria — for reflection, not diagnosis.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={onStart}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:translate-y-[-1px] hover:shadow-primary/30"
        >
          Start
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
        <span className="text-sm text-muted-foreground">
          Takes about 2 minutes
        </span>
      </div>
      <ul className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <Feature emoji="⌨️" label="Keyboard friendly" />
        <Feature emoji="↩️" label="Undo anytime" />
        <Feature emoji="🧭" label="One thing at a time" />
      </ul>
    </div>
  );
}

function Feature({ emoji, label }: { emoji: string; label: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur">
      <span className="text-base">{emoji}</span>
      <span>{label}</span>
    </li>
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
        In the past 6 months…
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
              <span className="text-2xl" aria-hidden>
                {s.emoji}
              </span>
              <span className="flex-1 text-base font-medium">{s.label}</span>
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
}: {
  result: {
    inattCount: number;
    hyperCount: number;
    inattMet: boolean;
    hyperMet: boolean;
    subtype: string;
    description: string;
  };
  onReset: () => void;
}) {
  return (
    <div className="space-y-8 py-8 animate-fade-up">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          🎉 Your result
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {result.subtype}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          {result.description}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <ScoreCard
            label="Inattention"
            count={result.inattCount}
            met={result.inattMet}
          />
          <ScoreCard
            label="Hyperactivity-Impulsivity"
            count={result.hyperCount}
            met={result.hyperMet}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-accent/40 p-6 text-sm leading-relaxed text-accent-foreground">
        <strong className="font-semibold">A note on interpretation.</strong> This
        screener counts a symptom toward the DSM-5 threshold when you answered
        “often” or “very often.” For adolescents 17+ and adults, 5 or more symptoms
        in a domain meets the count; children require 6. A diagnosis also requires
        onset before age 12, symptoms in 2+ settings, and clinically significant
        impairment — only a qualified clinician can establish that.
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
        This tool is for educational purposes only and does not replace a clinical
        evaluation. DSM-5 also requires symptom onset before age 12, presence in 2+
        settings, and clinically significant impairment.
      </p>
    </div>
  );
}

function ScoreCard({
  label,
  count,
  met,
}: {
  label: string;
  count: number;
  met: boolean;
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
        {met ? "Threshold met (5+)" : "Below threshold"}
      </p>
    </div>
  );
}
