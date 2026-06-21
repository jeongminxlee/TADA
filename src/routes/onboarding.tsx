import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import onboardingCalm from "@/assets/onboarding-calm.jpg";
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
  PSYCHOED,
  ageThreshold,
  saveOnboardingResult,
  seedDemoData,
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

  // Persist as soon as we have a result + onboarding, so refreshes don't lose it.
  useEffect(() => {
    if (phase !== "result" || !onboarding) return;
    saveOnboardingResult({
      onboarding,
      result,
      answers,
      completedAt: new Date().toISOString(),
    });
  }, [phase, onboarding, result, answers]);

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

  function skipWithDemo() {
    seedDemoData();
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
  const headline = result.partAPositive
    ? "Sounds like ADHD might really resonate with you"
    : "A few things stood out — but no strong pattern";
  const subhead = result.partAPositive
    ? "Lots of your answers line up with what people with ADHD often experience. It's worth chatting with your GP if it's getting in the way of life."
    : "Your answers don't strongly point to ADHD, but tracking how you feel can still be really useful.";
  return (
    <div className="space-y-6 py-8 animate-fade-up">
      <div
        className={
          "overflow-hidden rounded-3xl border shadow-sm " +
          (result.partAPositive
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card")
        }
      >
        <img
          src={ed.image}
          alt={ed.imageAlt}
          width={1024}
          height={1024}
          loading="lazy"
          className="h-44 w-full object-cover"
        />
        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
            Your check-in
          </p>
          <h2 className="mt-1 text-xl font-semibold leading-snug">{headline}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subhead}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
          Sounds like you
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{ed.title}</h3>
        <p className="mt-2 text-sm font-medium text-foreground/90">{ed.tagline}</p>
        {ed.body.map((p, i) => (
          <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">{p}</p>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-accent/30">
        <img
          src={onboardingCalm}
          alt="A warm mug held in cosy hands"
          width={1024}
          height={1024}
          loading="lazy"
          className="h-40 w-full object-cover"
        />
        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
            What's next
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            The app will use this to suggest small, doable things — gentle
            reminders, mood check-ins and one tiny task at a time. Nothing
            scary. You can change anything later.
          </p>
        </div>
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
          Try the questions again
        </button>
      </div>

      <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
        This is just for reflection — it isn't a diagnosis. If you're
        struggling, your GP is a great first stop. In a crisis, call 111
        (or 999 in an emergency), or the Samaritans on 116 123.
      </p>
    </div>
  );
}