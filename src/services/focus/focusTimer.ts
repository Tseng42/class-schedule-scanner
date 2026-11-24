import type { FocusSession, Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { toDateKey } from "../scheduling/dateKey";

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;
export const DEFAULT_LONG_BREAK_MINUTES = 15;
/** The classic Pomodoro rhythm: every fourth break is a long one. */
export const ROUNDS_PER_LONG_BREAK = 4;
/** Allowed lengths, in minutes. */
export const LENGTH_LIMITS = {
  focusMinutes: { min: 1, max: 180, label: "專注" },
  breakMinutes: { min: 1, max: 60, label: "休息" },
  longBreakMinutes: { min: 1, max: 90, label: "長休息" },
} as const;

/** A run left sitting after its break for this long counts as finished, so a forgotten timer doesn't linger on the home screen. */
const STALE_AFTER_MS = 60 * 60 * 1000;
/** The running timer is per device, so it lives outside the synced schedule. */
const RUN_KEY = "class-schedule-scanner:focus-run";

export type FocusPhase = "focus" | "break" | "breakDone";

export interface FocusLengths {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
}

export interface FocusRun extends FocusLengths {
  courseId?: string;
  phase: FocusPhase;
  /** When the current phase began, ms since epoch. Time left is always worked out from this, so a page that was asleep catches up. */
  phaseStartedAt: number;
  /** Focus rounds started so far, the current one included. */
  round: number;
}

export interface LoggedSession {
  id: string;
  session: FocusSession;
}

export function focusLengthsFrom(settings: AppSettings): FocusLengths {
  return {
    focusMinutes: settings.focusMinutes ?? DEFAULT_FOCUS_MINUTES,
    breakMinutes: settings.breakMinutes ?? DEFAULT_BREAK_MINUTES,
    longBreakMinutes: settings.longBreakMinutes ?? DEFAULT_LONG_BREAK_MINUTES,
  };
}

/** An error message for the first length out of range, or null when all are fine. */
export function validateLengths(lengths: Record<keyof FocusLengths, number | null>): string | null {
  for (const key of Object.keys(LENGTH_LIMITS) as (keyof FocusLengths)[]) {
    const { min, max, label } = LENGTH_LIMITS[key];
    const value = lengths[key];
    if (value === null || !Number.isInteger(value) || value < min || value > max) {
      return `${label}要填 ${min}–${max} 分鐘`;
    }
  }
  return null;
}

export function startRun(lengths: FocusLengths, courseId: string | undefined, now: number): FocusRun {
  return { ...lengths, courseId, phase: "focus", phaseStartedAt: now, round: 1 };
}

export function nextRound(run: FocusRun, now: number): FocusRun {
  return { ...run, phase: "focus", phaseStartedAt: now, round: run.round + 1 };
}

export function isLongBreak(run: FocusRun): boolean {
  return run.round % ROUNDS_PER_LONG_BREAK === 0;
}

/** Length of the current phase in ms; null once the break is over and the run waits for the next round. */
export function phaseLengthMs(run: FocusRun): number | null {
  if (run.phase === "focus") return run.focusMinutes * 60000;
  if (run.phase === "break") return (isLongBreak(run) ? run.longBreakMinutes : run.breakMinutes) * 60000;
  return null;
}

export function phaseEndsAt(run: FocusRun): number | null {
  const length = phaseLengthMs(run);
  return length === null ? null : run.phaseStartedAt + length;
}

/** One id per focus round, so two open tabs logging the same round keep one copy. */
function sessionFor(run: FocusRun, minutes: number): LoggedSession {
  const session: FocusSession = { startedAt: new Date(run.phaseStartedAt).toISOString(), minutes };
  if (run.courseId) session.courseId = run.courseId;
  return { id: `focus-${run.phaseStartedAt}`, session };
}

export interface Advance {
  /** Unchanged (the same object) when no phase has ended yet; null when the run is over. */
  run: FocusRun | null;
  /** A focus round that just finished, to be logged. */
  logged: LoggedSession | null;
  /** When the last phase change happened, ms since epoch; null if none. */
  changedAt: number | null;
}

/** Moves the run past any phase that has already ended by `now`: focus → break → waiting for the next round. */
export function advanceRun(run: FocusRun, now: number): Advance {
  let current = run;
  let logged: LoggedSession | null = null;
  let changedAt: number | null = null;

  if (current.phase === "focus") {
    const end = phaseEndsAt(current)!;
    if (now < end) return { run, logged, changedAt };
    logged = sessionFor(current, current.focusMinutes);
    current = { ...current, phase: "break", phaseStartedAt: end };
    changedAt = end;
  }
  if (current.phase === "break") {
    const end = phaseEndsAt(current)!;
    if (now >= end) {
      current = { ...current, phase: "breakDone", phaseStartedAt: end };
      changedAt = end;
    }
  }
  if (current.phase === "breakDone" && now - current.phaseStartedAt > STALE_AFTER_MS) {
    return { run: null, logged, changedAt };
  }
  return { run: current, logged, changedAt };
}

/** Ending early still counts: the whole minutes focused so far, if there's at least one. */
export function endRun(run: FocusRun, now: number): LoggedSession | null {
  if (run.phase !== "focus") return null;
  const minutes = Math.min(run.focusMinutes, Math.floor((now - run.phaseStartedAt) / 60000));
  return minutes >= 1 ? sessionFor(run, minutes) : null;
}

export function loadRun(): FocusRun | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as Partial<FocusRun>;
    const valid =
      (run.phase === "focus" || run.phase === "break" || run.phase === "breakDone") &&
      typeof run.phaseStartedAt === "number" &&
      typeof run.round === "number" &&
      typeof run.focusMinutes === "number" &&
      typeof run.breakMinutes === "number" &&
      typeof run.longBreakMinutes === "number";
    return valid ? (run as FocusRun) : null;
  } catch {
    return null;
  }
}

export function saveRun(run: FocusRun | null): void {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // The timer keeps working on screen; it just won't survive a reload.
  }
}

function sessions(schedule: Schedule): FocusSession[] {
  return Object.values(schedule.focusSessions ?? {});
}

/** Sessions started on days from `startKey` through `endKey` (local dates, inclusive); all time when omitted. */
export function focusSessionsBetween(schedule: Schedule, startKey?: string, endKey?: string): FocusSession[] {
  return sessions(schedule).filter((session) => {
    const key = toDateKey(new Date(session.startedAt));
    return (!startKey || key >= startKey) && (!endKey || key <= endKey);
  });
}

export function sumMinutes(list: FocusSession[]): number {
  return list.reduce((total, session) => total + session.minutes, 0);
}

export function focusMinutesByCourse(list: FocusSession[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of list) {
    if (!session.courseId) continue;
    totals.set(session.courseId, (totals.get(session.courseId) ?? 0) + session.minutes);
  }
  return totals;
}

/** "45 分鐘", "1 小時 2 分", "12 小時". */
export function formatFocusTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`;
  if (minutes >= 600) return `${Math.round(minutes / 60)} 小時`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} 小時${rest > 0 ? ` ${rest} 分` : ""}`;
}

/** "24:59" for the time left in a phase. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
