import type { PastSemester, Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { addDays, parseDateKey, toDateKey } from "./dateKey";

/** A semester to count things in: its schedule, its dates (in settings) and the moment to look from. */
export interface Term {
  schedule: Schedule;
  settings: AppSettings;
  now: Date;
  /** Over: a past semester, or the current one after its last day. */
  finished: boolean;
}

/** The day a past semester ended: its last day, or the day it was put away if that came first. */
export function archivedEndKey(past: PastSemester): string {
  const archivedKey = toDateKey(new Date(past.archivedAt));
  return past.endDate && past.endDate < archivedKey ? past.endDate : archivedKey;
}

/**
 * A past semester as it stood when it was put away, looked at from the midnight after it
 * ended so it reads as finished. Focus sessions were never cleared, so they come from the
 * live schedule.
 */
export function pastTerm(past: PastSemester, schedule: Schedule, settings: AppSettings): Term {
  const endKey = archivedEndKey(past);
  return {
    schedule: {
      version: 1,
      courses: past.courses,
      holidays: past.holidays,
      attendance: past.attendance,
      focusSessions: schedule.focusSessions,
    },
    settings: { ...settings, semesterStartDate: past.startDate, semesterEndDate: endKey },
    now: parseDateKey(addDays(endKey, 1)),
    finished: true,
  };
}

/** The current semester and every past one. */
export function allTerms(schedule: Schedule, settings: AppSettings, now: Date): Term[] {
  const end = settings.semesterEndDate;
  const current: Term = { schedule, settings, now, finished: Boolean(end && toDateKey(now) > end) };
  return [current, ...Object.values(schedule.pastSemesters ?? {}).map((past) => pastTerm(past, schedule, settings))];
}
