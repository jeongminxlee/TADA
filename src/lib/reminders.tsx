import { useEffect, useState, useCallback } from "react";
import { useCheckIns, todayISO } from "./adhd-shared";

const KEY = "adhd-reminders-v1";

export type ReminderSettings = {
  enabled: boolean;
  moodTime: string; // "HH:MM"
  taskTime: string;
};

const DEFAULTS: ReminderSettings = {
  enabled: false,
  moodTime: "20:00",
  taskTime: "09:00",
};

function load(): ReminderSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(s: ReminderSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("adhd-reminders-changed"));
}

export function useReminderSettings(): [ReminderSettings, (patch: Partial<ReminderSettings>) => void] {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULTS);
  useEffect(() => {
    setSettings(load());
    const onChange = () => setSettings(load());
    window.addEventListener("adhd-reminders-changed", onChange);
    return () => window.removeEventListener("adhd-reminders-changed", onChange);
  }, []);
  const update = useCallback((patch: Partial<ReminderSettings>) => {
    const next = { ...load(), ...patch };
    save(next);
  }, []);
  return [settings, update];
}

export async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function notify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: title });
  } catch {
    /* ignore */
  }
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Runs in the app shell. Every minute checks scheduled times and fires a
 * browser notification if the user hasn't satisfied the prompt yet today.
 */
export function ReminderRunner() {
  const [settings] = useReminderSettings();
  const [history] = useCheckIns();

  useEffect(() => {
    if (!settings.enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const firedKey = "adhd-reminders-fired-v1";
    const getFired = (): Record<string, string[]> => {
      try { return JSON.parse(localStorage.getItem(firedKey) || "{}"); } catch { return {}; }
    };
    const markFired = (kind: string) => {
      const fired = getFired();
      const today = todayISO();
      const arr = fired[today] || [];
      if (!arr.includes(kind)) arr.push(kind);
      fired[today] = arr;
      // prune older days
      Object.keys(fired).forEach((k) => { if (k !== today) delete fired[k]; });
      localStorage.setItem(firedKey, JSON.stringify(fired));
    };
    const wasFired = (kind: string) => (getFired()[todayISO()] || []).includes(kind);

    const tick = () => {
      if (Notification.permission !== "granted") return;
      const hm = nowHM();
      const today = todayISO();
      const loggedToday = history.some((c) => c.date === today);

      if (hm === settings.moodTime && !wasFired("mood") && !loggedToday) {
        notify("TADA — log your mood", "Quick 10-second mood check-in.");
        markFired("mood");
      }
      if (hm === settings.taskTime && !wasFired("task")) {
        notify("TADA — your daily plan", "Open Tasks to see today's adaptive next step.");
        markFired("task");
      }
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [settings.enabled, settings.moodTime, settings.taskTime, history]);

  return null;
}