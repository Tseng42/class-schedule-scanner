import type { AttendanceStatus, Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { focusSessionsBetween, sumMinutes } from "../focus/focusTimer";
import { attendanceOf } from "./attendance";
import { addDays, parseDateKey, toDateKey } from "./dateKey";
import { listEvents, type ScheduledEvent } from "./events";
import { getOccurrencesForDate } from "./nextClass";
import { mondayOf, toMinutes } from "./weekLayout";

/*
 * 每週小回顧: last week (Monday to Sunday) at a glance, plus what this week holds.
 * Everything is worked out from what's already recorded, so nothing extra is stored
 * except which week's card was put away.
 */

/** The card shows Monday through this many days later (Wednesday), unless put away first. */
const SHOW_DAYS = 3;
const EARLY_BEFORE = "09:00";

export interface WeeklyReview {
  /** Monday of the week looked back on; also what's saved when the card is put away. */
  weekKey: string;
  /** Sunday of that week. */
  endKey: string;
  classCount: number;
  classMinutes: number;
  /** Marked classes by status. */
  attendance: Record<AttendanceStatus, number>;
  unmarked: number;
  /** 有到 or 遲到 at a class starting before 9. */
  earlyCount: number;
  focusMinutes: number;
  /** Focus minutes the week before, to compare with. */
  previousFocusMinutes: number;
  /** Assignments due last week, checked off or not. */
  assignmentsDone: number;
  assignmentsOpen: number;
  /** Badge levels earned during the week, as storage keys. */
  badges: string[];
  /** Exams this week, and assignments due this week not yet done. */
  thisWeek: ScheduledEvent[];
}

/** Monday key of the week before the one `now` is in. */
export function lastWeekKey(now: Date): string {
  return addDays(toDateKey(mondayOf(now)), -7);
}

/** Monday through Wednesday, the days the card can be up. */
export function isWeeklyReviewDay(now: Date): boolean {
  const day = now.getDay();
  return day >= 1 && day <= SHOW_DAYS;
}

/** Last week's review, or null when nothing at all happened in it. */
export function buildWeeklyReview(schedule: Schedule, settings: AppSettings, now: Date): WeeklyReview | null {
  const weekKey = lastWeekKey(now);
  const endKey = addDays(weekKey, 6);
  const attendance: Record<AttendanceStatus, number> = { present: 0, late: 0, leave: 0, official: 0, absent: 0 };
  let classCount = 0;
  let classMinutes = 0;
  let unmarked = 0;
  let earlyCount = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    for (const occurrence of getOccurrencesForDate(schedule, parseDateKey(addDays(weekKey, offset)), settings)) {
      if (occurrence.endAt > now) continue;
      classCount += 1;
      classMinutes += toMinutes(occurrence.timeSlot.endTime) - toMinutes(occurrence.timeSlot.startTime);
      const status = attendanceOf(schedule, occurrence)?.status;
      if (!status) {
        unmarked += 1;
        continue;
      }
      attendance[status] += 1;
      if ((status === "present" || status === "late") && occurrence.timeSlot.startTime < EARLY_BEFORE) earlyCount += 1;
    }
  }

  const focusMinutes = sumMinutes(focusSessionsBetween(schedule, weekKey, endKey));
  const previousFocusMinutes = sumMinutes(focusSessionsBetween(schedule, addDays(weekKey, -7), addDays(weekKey, -1)));

  const events = listEvents(schedule);
  const dueLastWeek = events.filter(
    (item) => item.event.kind === "assignment" && item.event.date >= weekKey && item.event.date <= endKey,
  );
  const assignmentsDone = dueLastWeek.filter((item) => item.event.done).length;

  const badges = Object.entries(schedule.achievements ?? {})
    .filter(([, at]) => {
      const key = toDateKey(new Date(at));
      return key >= weekKey && key <= endKey;
    })
    .map(([key]) => key);

  if (classCount === 0 && focusMinutes === 0 && dueLastWeek.length === 0 && badges.length === 0) return null;

  const thisMonday = addDays(weekKey, 7);
  const thisSunday = addDays(thisMonday, 6);
  const thisWeek = events.filter(
    (item) =>
      item.event.date >= thisMonday &&
      item.event.date <= thisSunday &&
      (item.event.kind === "exam" || (item.event.kind === "assignment" && !item.event.done)),
  );

  return {
    weekKey,
    endKey,
    classCount,
    classMinutes,
    attendance,
    unmarked,
    earlyCount,
    focusMinutes,
    previousFocusMinutes,
    assignmentsDone,
    assignmentsOpen: dueLastWeek.length - assignmentsDone,
    badges,
    thisWeek,
  };
}
