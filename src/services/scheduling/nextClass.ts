import { DAY_OF_WEEK_LABELS, type Course, type Recurrence, type TimeSlot } from "../../schema/course";
import type { Schedule } from "../../schema/schedule";
import { combineDateAndTime, dayOfWeekOf, toDateKey } from "./dateKey";

export interface CourseOccurrence {
  course: Course;
  timeSlot: TimeSlot;
  dateKey: string;
  startAt: Date;
  endAt: Date;
  /** Set only when the class is cancelled that day (and cancelled ones were asked for). */
  cancelledReason?: string;
}

function isWithin(dateKey: string, startDate: string, endDate: string): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

/** Why this course doesn't meet on the given date, or null if it does. Course-specific reasons win over holidays. */
export function getCancellationReason(schedule: Schedule, course: Course, dateKey: string): string | null {
  const cancellation = course.cancellations?.find((item) => isWithin(dateKey, item.startDate, item.endDate));
  if (cancellation) return cancellation.reason?.trim() || "停課";
  const holiday = schedule.holidays?.find((item) => isWithin(dateKey, item.startDate, item.endDate));
  if (holiday) return holiday.name.trim() || "放假";
  return null;
}

function isRecurrenceActiveOn(recurrence: Recurrence, dateKey: string): boolean {
  if (recurrence.type === "once") return recurrence.date === dateKey;
  if (recurrence.startDate && dateKey < recurrence.startDate) return false;
  if (recurrence.endDate && dateKey > recurrence.endDate) return false;
  return true;
}

/**
 * All course occurrences that fall on the given calendar date, sorted by start time.
 * Cancelled classes are left out unless `includeCancelled` is set (the timetable grid
 * shows them greyed out; reminders and the next-class card must not).
 */
export function getOccurrencesForDate(
  schedule: Schedule,
  date: Date,
  includeCancelled = false,
): CourseOccurrence[] {
  const dateKey = toDateKey(date);
  const dayCode = dayOfWeekOf(dateKey);
  const occurrences: CourseOccurrence[] = [];
  for (const course of schedule.courses) {
    if (!isRecurrenceActiveOn(course.recurrence, dateKey)) continue;
    const cancelledReason = getCancellationReason(schedule, course, dateKey);
    if (cancelledReason && !includeCancelled) continue;
    for (const slot of course.timeSlots) {
      if (slot.dayOfWeek !== dayCode) continue;
      occurrences.push({
        course,
        timeSlot: slot,
        dateKey,
        startAt: combineDateAndTime(dateKey, slot.startTime),
        endAt: combineDateAndTime(dateKey, slot.endTime),
        ...(cancelledReason ? { cancelledReason } : {}),
      });
    }
  }
  return occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function findCurrentOccurrence(
  occurrences: CourseOccurrence[],
  now: Date,
): CourseOccurrence | undefined {
  return occurrences.find((occurrence) => now >= occurrence.startAt && now < occurrence.endAt);
}

/** Searches up to a week ahead (today included) for the next occurrence that hasn't started yet. */
export function getNextOccurrence(schedule: Schedule, now: Date): CourseOccurrence | null {
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const occurrences = getOccurrencesForDate(schedule, date);
    const upcoming = occurrences.find((occurrence) => occurrence.startAt.getTime() > now.getTime());
    if (upcoming) return upcoming;
  }
  return null;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} 分`);
  return parts.join(" ");
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatOccurrenceDay(occurrence: CourseOccurrence, now: Date): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDate(occurrence.startAt, now)) return "今天";
  if (isSameDate(occurrence.startAt, tomorrow)) return "明天";
  return DAY_OF_WEEK_LABELS[occurrence.timeSlot.dayOfWeek];
}
