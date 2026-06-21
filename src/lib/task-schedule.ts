// Helpers for auto-scheduling user to-dos on a 24h day timeline.

export type ScheduledTask = {
  id: number;
  title: string;
  done: boolean;
  startMin?: number; // minutes from 00:00
  durationMin?: number;
};

// Rough, plain-language duration guesses (in minutes).
export function estimateDurationMin(title: string): number {
  const t = title.toLowerCase();

  // Explicit "X min" / "X hour"
  const m = t.match(/(\d+)\s*(?:min|minutes?|mins)\b/);
  if (m) return Math.max(5, Math.min(8 * 60, parseInt(m[1], 10)));
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (h) return Math.max(5, Math.min(8 * 60, Math.round(parseFloat(h[1]) * 60)));

  // Keyword buckets
  if (/(quick|brief|skim)/.test(t)) return 10;
  if (/(email|reply|text|message|dm|whatsapp)/.test(t)) return 15;
  if (/(call|phone|standup|sync|check[- ]?in)/.test(t)) return 30;
  if (/(meeting|interview|workshop|class|lecture)/.test(t)) return 60;
  if (/(walk|run|exercise|workout|gym|yoga|stretch)/.test(t)) return 30;
  if (/(meal prep|cook|dinner|lunch|breakfast|recipe)/.test(t)) return 45;
  if (/(grocery|groceries|shop|shopping|errand|errands)/.test(t)) return 45;
  if (/(clean|tidy|laundry|dishes|wash|hoover|vacuum)/.test(t)) return 30;
  if (/(read|study|revise|review|research|plan|prep)/.test(t)) return 45;
  if (/(write|draft|report|essay|document|build|code|design|edit)/.test(t)) return 60;
  if (/(appointment|doctor|gp|dentist|therapy|therapist)/.test(t)) return 60;
  if (/(commute|drive|travel|train)/.test(t)) return 30;
  if (/(shower|bath|brush|skincare|self[- ]?care)/.test(t)) return 15;

  return 30;
}

// Find the next free slot ≥ desired start that fits durationMin without
// overlapping any already-scheduled task.
export function nextFreeStartMin(
  existing: { startMin?: number; durationMin?: number }[],
  desiredMin: number,
  durationMin: number,
): number {
  const day = 24 * 60;
  const slots = existing
    .filter((t) => typeof t.startMin === "number" && typeof t.durationMin === "number")
    .map((t) => ({ s: t.startMin as number, e: (t.startMin as number) + (t.durationMin as number) }))
    .sort((a, b) => a.s - b.s);

  let start = Math.max(0, Math.min(desiredMin, day - durationMin));
  for (const slot of slots) {
    if (start + durationMin <= slot.s) return start;
    if (start < slot.e) start = slot.e;
  }
  if (start + durationMin > day) start = Math.max(0, day - durationMin);
  return start;
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// 9am if before 9am, otherwise round up to the next 15 minutes.
export function defaultStartMin(): number {
  const now = nowMinutes();
  if (now < 9 * 60) return 9 * 60;
  return Math.min(23 * 60, Math.ceil(now / 15) * 15);
}

export function fmtTime(mins: number): string {
  const total = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h < 12 ? "am" : "pm";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${String(m).padStart(2, "0")}${ampm}`;
}

export function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

// Detect "add task" style chat intents. Returns the cleaned task title if matched.
export function parseAddTaskIntent(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const patterns: RegExp[] = [
    /^(?:please\s+)?(?:can you\s+)?add\s+(?:a\s+)?(?:new\s+)?task[:\-\s]+(.+)$/i,
    /^(?:please\s+)?(?:can you\s+)?add\s+(?:to\s+(?:my\s+)?(?:list|tasks?|to-?dos?)[:\-\s]+)(.+)$/i,
    /^(?:new task|task)[:\-]\s*(.+)$/i,
    /^(?:please\s+)?(?:can you\s+)?(?:remind me to|i need to|i have to|i must)\s+(.+)$/i,
    /^(?:put|schedule)\s+(.+?)\s+(?:on|in)\s+(?:my\s+)?(?:list|calendar|tasks?)$/i,
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1]) {
      return m[1].replace(/[.!?]+$/, "").trim();
    }
  }
  return null;
}

// Storage key shared by the chat (HomeRoute) and the Tasks page so that
// tasks added via chat appear immediately in the calendar.
export function customTasksKey(dateISO: string) {
  return `adhd-custom-tasks-${dateISO}`;
}
