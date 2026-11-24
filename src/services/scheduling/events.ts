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

/** Assignments and other to-dos can be checked off; exams can't. */
export function isTask(event: CourseEvent): boolean {
  return event.kind !== "exam";
}

export interface HomeEvents {
  /** Flagged 急 and not yet done, overdue or not. */
  urgent: ScheduledEvent[];
  /** To-dos past their date and still not checked off, oldest first. */
  overdue: ScheduledEvent[];
  /** Everything else from today through `withinDays`, soonest first. */
  upcoming: ScheduledEvent[];
}

/**
 * What the home screen's 近期事項 shows. Checked-off to-dos drop out, except the ones in
 * `keepIds` (checked during this visit), which stay put so a mis-tap is easy to undo.
 * Overdue to-dos only go back as far as `sinceKey` (the semester start) when it's set.
 */
export function getHomeEvents(
  schedule: Schedule,
  now: Date,
  sinceKey: string | null,
  keepIds: ReadonlySet<string>,
  withinDays = 30,
): HomeEvents {
  const todayKey = toDateKey(now);
  const limit = parseDateKey(todayKey);
  limit.setDate(limit.getDate() + withinDays);
  const limitKey = toDateKey(limit);

  const result: HomeEvents = { urgent: [], overdue: [], upcoming: [] };
  for (const item of listEvents(schedule)) {
    const { event } = item;
    if (event.done && !keepIds.has(event.id)) continue;
    if (event.date < todayKey) {
      if (!isTask(event) || (sinceKey && event.date < sinceKey)) continue;
      if (event.urgent) result.urgent.push(item);
      else result.overdue.push(item);
    } else if (event.date <= limitKey) {
      if (isTask(event) && event.urgent) result.urgent.push(item);
      else result.upcoming.push(item);
    }
  }
  return result;
}

/** Whole calendar days from `now`'s date until the event's date (0 = today). */
export function daysUntil(event: CourseEvent, now: Date): number {
  const today = parseDateKey(toDateKey(now)).getTime();
  const target = parseDateKey(event.date).getTime();
  return Math.round((target - today) / 86400000);
}

export function formatDaysUntil(days: number): string {
  if (days < 0) return `過期 ${-days} 天`;
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天後`;
}
