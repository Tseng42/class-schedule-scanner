import type { Course, Recurrence } from "../../schema/course";

/**
 * A one-off makeup class ("補課") commonly reuses the regular course's name,
 * day-of-week, and time — it's just moved to a different date. Without this
 * check, saving it would look identical to the recurring weekly class it's
 * making up for and get silently dropped as a duplicate.
 */
function sameRecurrence(a: Recurrence, b: Recurrence): boolean {
  if (a.type !== b.type) return false;
  return a.type === "once" && b.type === "once" ? a.date === b.date : true;
}

/** Same course name + recurrence + at least one identical time slot: two records of the same class. */
export function isSameCourse(a: Course, b: Course): boolean {
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    sameRecurrence(a.recurrence, b.recurrence) &&
    a.timeSlots.some((slot) =>
      b.timeSlots.some(
        (other) =>
          slot.dayOfWeek === other.dayOfWeek && slot.startTime === other.startTime && slot.endTime === other.endTime,
      ),
    )
  );
}
