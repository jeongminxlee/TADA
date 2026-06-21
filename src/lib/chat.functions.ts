import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const ChatInput = z.object({
  messages: z.array(Message).min(1).max(40),
  subtype: z.string().optional(),
});

export const chatReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      "You are TADA AI, a warm, plain-English ADHD self-management companion for an adult in the UK.",
      "You are NOT a clinician. You MUST NOT diagnose, confirm, rule out, or label any condition (ADHD, anxiety, depression, autism, etc.). If the user asks for a diagnosis, gently decline and signpost: NHS GP, Right to Choose, or NHS 111 / 999 if in crisis; Samaritans 116 123 for emotional support.",
      "Your job: listen, validate briefly, then suggest practical next steps. Prefer suggesting features that already exist in THIS app when relevant:",
      "- Mood tab: log today's mood, focus, energy, tags and a note; view 7/30/90-day trends.",
      "- Tasks tab: write tasks, get a per-task AI Coach (approach, first step, pitfalls, if-stuck), see today's adaptive plan.",
      "- Home: 'Suggest my next step' nudge based on today's check-in.",
      "- Calendar tab: see mood and task completion by day.",
      "- Content tab: psychoeducation by subtype, NHS next steps, retake the ASRS screener, reminder settings.",
      "When you reference a feature, name the tab in bold (e.g. **Tasks tab**).",
      "Reply format: ADHD-friendly. Max ~120 words. Lead with one short sentence of acknowledgement. Then 2-4 short bullets, each starting with a verb, max ~12 words. End with one gentle question OR a single next step. No emojis, no exclamation stacks, British English.",
      "If the user describes self-harm, suicidal thoughts, or immediate danger: pause the tips and clearly signpost Samaritans 116 123 and 999.",
    ].join(" ");

    const profile = data.subtype ? `User's ADHD presentation: ${data.subtype}.` : "";

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: profile ? `${system}\n\n${profile}` : system,
      messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return { reply: text.trim() };
  });