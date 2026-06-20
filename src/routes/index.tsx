import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

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
  { label: "Never", value: 0 },
  { label: "Rarely", value: 1 },
  { label: "Sometimes", value: 2 },
  { label: "Often", value: 3 },
  { label: "Very often", value: 4 },
];

// Per DSM-5, a symptom "counts" toward the subtype threshold if it occurs
// often or very often (>= 3 on this 0–4 scale).
const COUNT_THRESHOLD = 3;
const ADULT_SYMPTOM_THRESHOLD = 5; // 5+ for adolescents 17+/adults; 6+ for children

type Answers = Record<string, number | null>;

function Index() {
  const total = INATTENTION.length + HYPERACTIVITY.length;
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);

  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
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

  const canSubmit = answered === total;

  function reset() {
    setAnswers({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            DSM-5 self-screener
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            ADHD subtype questionnaire
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Reflect on the last six months. For each statement, choose how often it
            applies to you. This is an informational screener based on the DSM-5
            criteria — it is not a diagnosis.
          </p>
        </header>

        {!submitted && (
          <div className="sticky top-0 z-10 -mx-6 mb-8 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {answered} of {total} answered
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {submitted ? (
          <Results result={result} onReset={reset} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) setSubmitted(true);
            }}
            className="space-y-12"
          >
            <Section
              title="Inattention"
              caption="Nine criteria — needing 5+ marked 'often' or 'very often' for adults."
              prefix="I"
              items={INATTENTION}
              answers={answers}
              setAnswers={setAnswers}
            />
            <Section
              title="Hyperactivity & Impulsivity"
              caption="Nine criteria — needing 5+ marked 'often' or 'very often' for adults."
              prefix="H"
              items={HYPERACTIVITY}
              answers={answers}
              setAnswers={setAnswers}
            />

            <div className="flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {canSubmit
                  ? "All set — review your result."
                  : `Answer all ${total} items to see your result.`}
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                See my result
              </button>
            </div>
          </form>
        )}

        <footer className="mt-16 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          This tool is for educational purposes only and does not replace a clinical
          evaluation. DSM-5 also requires that symptoms be present before age 12, occur
          in two or more settings, and cause clinically significant impairment.
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  caption,
  prefix,
  items,
  answers,
  setAnswers,
}: {
  title: string;
  caption: string;
  prefix: "I" | "H";
  items: string[];
  answers: Answers;
  setAnswers: (a: Answers) => void;
}) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
      </div>
      <ol className="space-y-4">
        {items.map((item, i) => {
          const key = `${prefix}${i}`;
          const current = answers[key];
          return (
            <li
              key={key}
              className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-primary/40"
            >
              <div className="flex gap-4">
                <span className="mt-0.5 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="flex-1 text-[15px] leading-relaxed text-card-foreground">
                  {item}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {SCALE.map((s) => {
                  const selected = current === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setAnswers({ ...answers, [key]: s.value })}
                      className={
                        "rounded-xl border px-2 py-2.5 text-xs font-medium transition sm:text-sm " +
                        (selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground")
                      }
                      aria-pressed={selected}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
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
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Result
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
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
          className="inline-flex items-center justify-center rounded-full border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/50"
        >
          Retake
        </button>
      </div>
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
