import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const NudgeInput = z.object({
  mood: z.number().int().min(1).max(5).nullable(),
  focus: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  subtype: z.string().optional(),
  tasks: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
});

const NudgeOutput = z.object({
  task: z.string(),
  firstStep: z.string(),
  encouragement: z.string(),
});

export const suggestNudge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NudgeInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      "You are a warm, no-judgement ADHD coach helping an adult in the UK take one small action.",
      "You receive their current mood/focus/energy (1-5), their ADHD presentation if known, and a short list of tasks they wrote down.",
      "Pick exactly ONE task from their list — the one most likely to get done given how they feel right now (low energy = pick the easiest; high energy = pick something with momentum).",
      "Break it into a single first step that can be finished in 5 minutes or less. Be concrete: include the verb, the object, and where to start. No multi-step plans.",
      "Then give one short, kind sentence of encouragement. No toxic positivity, no exclamation marks stacked, no emojis.",
      "Use British English. Keep every field short.",
    ].join(" ");

    const profile = [
      data.subtype ? `Presentation: ${data.subtype}.` : null,
      data.mood ? `Mood ${data.mood}/5.` : null,
      data.focus ? `Focus ${data.focus}/5.` : null,
      data.energy ? `Energy ${data.energy}/5.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const prompt = [
      profile || "No check-in data yet.",
      "Their task list:",
      ...data.tasks.map((t, i) => `${i + 1}. ${t}`),
    ].join("\n");

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
      output: Output.object({ schema: NudgeOutput }),
    });

    return output;
  });

const CoachInput = z.object({
  task: z.string().trim().min(1).max(200),
  mood: z.number().int().min(1).max(5).nullable(),
  focus: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  subtype: z.string().optional(),
});

const CoachOutput = z.object({
  approach: z.string(),
  firstStep: z.string(),
  pitfall: z.string(),
  ifStuck: z.string(),
  reference: z.string(),
});

export const coachTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CoachInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      "You are a clinically informed ADHD coach for an adult in the UK.",
      "Ground your advice in the published ADHD literature: Safren et al. CBT for adult ADHD (2005/2010), Barkley's executive-function model (2012), NICE guideline NG87, and CHADD/ADHD UK clinical summaries.",
      "You receive ONE task plus the user's ADHD presentation and their current mood/focus/energy (1-5).",
      "Tailor the approach to BOTH the subtype and the current state:",
      "- Inattentive: externalise (lists, timers), reduce decisions, body-doubling, 25-min focus blocks.",
      "- Hyperactive-Impulsive: build in movement, pause-and-name before acting, channel restlessness rather than suppress it.",
      "- Combined: blend both; protect attention while giving the body an outlet.",
      "- Low energy/focus: shrink the task; rely on momentum tricks (2-minute rule, smallest possible start).",
      "- High energy: ride it; pair with the hardest or most-avoided part.",
      "Use British English. Be concrete and specific to the task. No emojis. Keep each field short (one or two sentences).",
    ].join(" ");

    const profile = [
      data.subtype ? `Presentation: ${data.subtype}.` : null,
      data.mood ? `Mood ${data.mood}/5.` : null,
      data.focus ? `Focus ${data.focus}/5.` : null,
      data.energy ? `Energy ${data.energy}/5.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const prompt = [
      profile || "No check-in data yet.",
      `Task: ${data.task}`,
      "",
      "Give: an approach tailored to their subtype and current state; a concrete first step they can do in under 5 minutes; the most likely pitfall for someone with their presentation on a task like this; a single rescue move if they get stuck; and the literature reference your approach draws from (e.g. 'Safren CBT-ADHD', 'Barkley 2012', 'NICE NG87').",
    ].join("\n");

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
      output: Output.object({ schema: CoachOutput }),
    });

    return output;
  });