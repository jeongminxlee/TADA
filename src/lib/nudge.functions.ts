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