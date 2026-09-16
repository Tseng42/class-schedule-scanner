import type { CourseOccurrence } from "../scheduling/nextClass";

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
