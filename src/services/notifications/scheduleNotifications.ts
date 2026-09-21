import type { CourseOccurrence } from "../scheduling/nextClass";
import type { ScheduledEvent } from "../scheduling/events";

// setTimeout delays are a 32-bit signed int internally; anything beyond this
// overflows and fires almost immediately instead of at the intended time.
const MAX_TIMEOUT_DELAY = 2_147_000_000;

/** Only fires reminders whose reminder point hasn't already passed. Returns a cleanup that clears all timers. */
export function scheduleReminders(
  occurrences: CourseOccurrence[],
  reminderMinutes: number,
  now: Date,
  onFire: (occurrence: CourseOccurrence) => void,
): () => void {
  const timers = occurrences
    .map((occurrence) => {
      const delay = occurrence.startAt.getTime() - reminderMinutes * 60000 - now.getTime();
      return delay > 0 && delay <= MAX_TIMEOUT_DELAY
        ? window.setTimeout(() => onFire(occurrence), delay)
        : null;
    })
    .filter((timer): timer is number => timer !== null);

  return () => {
    for (const timer of timers) window.clearTimeout(timer);
  };
}

/** Schedules a timer per event at its own reminder time, skipping ones already past or out of timer range. */
export function scheduleEventReminders(
  events: ScheduledEvent[],
  now: Date,
  onFire: (item: ScheduledEvent) => void,
): () => void {
  const timers = events
    .map((item) => {
      if (!item.fireAt) return null;
      const delay = item.fireAt.getTime() - now.getTime();
      return delay > 0 && delay <= MAX_TIMEOUT_DELAY ? window.setTimeout(() => onFire(item), delay) : null;
    })
    .filter((timer): timer is number => timer !== null);

  return () => {
    for (const timer of timers) window.clearTimeout(timer);
  };
}
