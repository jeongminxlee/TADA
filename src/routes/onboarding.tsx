import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ASRS,
  COUNT_THRESHOLD,
  QUESTIONS,
  BackgroundBlobs,
  Intro,
  OnboardingStep,
  TopBar,
  QuestionCard,
  NavBar,
  ScoreCard,
  PSYCHOED,
  ageThreshold,
  saveOnboardingResult,
  type Answers,
  type OnboardingData,
  type ResultPayload,
} from "@/lib/adhd-shared";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — ADHD screener" },
      { name: "description", content: "WHO ASRS v1.1 adult ADHD screener — one-time onboarding for the app." },
    ],
  }),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const total = QUESTIONS.length;
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"intro" | "onboarding" | "quiz" | "result">("intro");
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [pulse, setPulse] = useState(0);

  const started = phase === "quiz";
  const threshold = onboarding ? ageThreshold(onboarding.age) : 5;
  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const submitted = step >= total && started;
  const currentQ = !submitted && started ? QUESTIONS[step] : null;
  const progress = Math.round((answered / total) * 100);

  const result: ResultPayload = useMemo(() => {
    const inattItems = ASRS.filter((i) => i.domain === "Inattention");
    const hyperItems = ASRS.filter((i) => i.domain === "Hyperactivity & Impulsivity");
    const inattCount = inattItems.filter(
      (it) => (answers[`Q${it.num}`] ?? -1) >= COUNT_THRESHOLD,
    ).length;
    const hyperCount = hyperItems.filter(
      (it) => (answers[`Q${it.num}`] ?? -1) >= COUNT_THRESHOLD,
    ).length;
    const partAItems = ASRS.filter((i) => i.partA);
    const partAShaded = partAItems.filter(
      (it) => (answers[`Q${it.num}`] ?? -1) >= (it.shadeFrom ?? 3),
    ).length;
    const partAPositive = partAShaded >= 4;
    const inattMet = inattCount >= threshold;
    const hyperMet = hyperCount >= threshold;
    let subtype = "Below DSM-5 symptom threshold";
    let key: ResultPayload["key"] = "below";
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
    window.setTimeout(() => {
      setStep((s) => Math.min(s + 1, total));
    }, 220);
  }
  function goBack() { setStep((s) => Math.max(0, s - 1)); }
  function skip() { setStep((s) => Math.min(s + 1, total)); }

  // When the quiz hits the end, flip to the result/psychoed phase.
  useEffect(() => {
    if (submitted && phase === "quiz") setPhase("result");
  }, [submitted, phase]);

  function finish() {
    if (!onboarding) return;
    saveOnboardingResult({
      onboarding,
      result,
      answers,
      completedAt: new Date().toISOString(),
    });
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <BackgroundBlobs />
      <div
        className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-8 pt-6"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        {phase === "intro" && <Intro onStart={() => setPhase("onboarding")} />}

        {phase === "onboarding" && (
          <OnboardingStep
            initial={onboarding}
            onSubmit={(data: OnboardingData) => {
              setOnboarding(data);
              setPhase("quiz");
            }}
            onBack={() => setPhase("intro")}
          />
        )}

        {phase === "quiz" && currentQ && (
          <>
            <TopBar
              step={step}
              total={total}
              answered={answered}
              progress={progress}
              domain={currentQ.domain}
            />
            <QuestionCard
              key={currentQ.key}
              q={currentQ}
              current={answers[currentQ.key] ?? null}
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

        {phase === "result" && (
          <OnboardingResult
            result={result}
            onContinue={finish}
            onRetake={() => {
              setAnswers({});
              setStep(0);
              setPhase("quiz");
            }}
          />
        )}
      </div>
    </main>
  );
}

function OnboardingResult({
  result,
  onContinue,
  onRetake,
}: {
  result: ResultPayload;
  onContinue: () => void;
  onRetake: () => void;
}) {
  const ed = PSYCHOED[result.key];
  return (
    <div className="space-y-6 py-8 animate-fade-up">
      <div
        className={
          "rounded-3xl border p-5 shadow-sm " +
          (result.partAPositive
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card")
        }
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
          ASRS v1.1 · Part A screener
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          {result.partAPositive
            ? "Symptoms highly consistent with adult ADHD"
            : "Below the Part A screening threshold"}
        </h2>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{result.partAShaded}</span>
          <span className="text-sm text-muted-foreground">/ 6 shaded</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          The WHO-validated Part A screener (Kessler et al., 2005) flags scores
          of 4 or more as warranting further assessment by a GP. This is not a
          diagnosis.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
          Your result
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{result.subtype}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {result.description}
        </p>
        <div className="mt-4 grid gap-3">
          <ScoreCard label="Inattention" count={result.inattCount} met={result.inattMet} threshold={result.threshold} />
          <ScoreCard label="Hyperactivity-Impulsivity" count={result.hyperCount} met={result.hyperMet} threshold={result.threshold} />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-accent/30 p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
          What this means · {ed.title}
        </p>
        <p className="mt-1 text-base font-medium">{ed.tagline}</p>
        {ed.body.map((p, i) => (
          <p key={i} className="mt-2 text-sm leading-relaxed text-foreground/90">{p}</p>
        ))}
        <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">{ed.refs}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-90"
        >
          Continue to the app
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition hover:bg-accent/30"
        >
          Retake the screener
        </button>
      </div>

      <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
        For educational use only and not a substitute for NHS clinical
        assessment. If you're in distress, call NHS 111 (or 999 in an
        emergency). For mental health support, contact the Samaritans on 116 123.
      </p>
    </div>
  );
}