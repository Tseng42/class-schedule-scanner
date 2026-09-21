import type { Course, CourseEvent } from "../../schema/course";
import type { Schedule } from "../../schema/schedule";
import { combineDateAndTime, parseDateKey, toDateKey } from "./dateKey";

/** Events without a time are all-day; reminders are anchored to this time of day. */
export const ALL_DAY_ANCHOR_TIME = "09:00";

export interface ScheduledEvent {
  course: Course;
  event: CourseEvent;
  /** When the event happens (or the all-day anchor time for date-only events). */
  startAt: Date;
  allDay: boolean;
  /** When to remind, or null if this event has no reminder. */
  fireAt: Date | null;
}

export function toScheduledEvent(course: Course, event: CourseEvent): ScheduledEvent {
  const startAt = combineDateAndTime(event.date, event.time ?? ALL_DAY_ANCHOR_TIME);
  return {
    course,
    event,
    startAt,
    allDay: event.time === undefined,
    fireAt: event.remindMinutes ? new Date(startAt.getTime() - event.remindMinutes * 60000) : null,
  };
}

/** Every event across all courses, soonest first. */
export function listEvents(schedule: Schedule): ScheduledEvent[] {
  return schedule.courses
    .flatMap((course) => (course.events ?? []).map((event) => toScheduledEvent(course, event)))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Events from today onward (date-based, so today's earlier-hour events still show), within `withinDays`. */
export function getUpcomingEvents(schedule: Schedule, now: Date, withinDays = 30): ScheduledEvent[] {
  const todayKey = toDateKey(now);
  const limit = parseDateKey(todayKey);
  limit.setDate(limit.getDate() + withinDays);
  return listEvents(schedule).filter(
    (item) => item.event.date >= todayKey && parseDateKey(item.event.date).getTime() <= limit.getTime(),
  );
}

/** Whole calendar days from `now`'s date until the event's date (0 = today). */
export function daysUntil(event: CourseEvent, now: Date): number {
  const today = parseDateKey(toDateKey(now)).getTime();
  const target = parseDateKey(event.date).getTime();
  return Math.round((target - today) / 86400000);
}

export function formatDaysUntil(days: number): string {
  if (days <= 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天後`;
}
