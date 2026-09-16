import type { CourseOccurrence } from "../scheduling/nextClass";

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
      return delay > 0 ? window.setTimeout(() => onFire(occurrence), delay) : null;
    })
    .filter((timer): timer is number => timer !== null);

  return () => {
    for (const timer of timers) window.clearTimeout(timer);
  };
}
