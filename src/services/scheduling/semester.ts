import type { Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { parseDateKey, toDateKey } from "./dateKey";
import { mondayOf, weeksBetween } from "./weekLayout";

export type SemesterStatus =
  | { kind: "before"; daysUntilStart: number }
  /** `totalWeeks` and `fraction` are null when no end date is set. */
  | { kind: "during"; week: number; totalWeeks: number | null; fraction: number | null };

export type HolidayCountdown =
  | { kind: "upcoming"; name: string; startDate: string; endDate: string; days: number }
  | { kind: "ongoing"; name: string; startDate: string; endDate: string };

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime()) / 86400000);
}

/** Where today sits in the semester; null without a start date or once the semester is over. */
export function getSemesterStatus(settings: AppSettings, today: Date): SemesterStatus | null {
  const { semesterStartDate: start, semesterEndDate: end } = settings;
  if (!start) return null;
  const todayKey = toDateKey(today);
  if (todayKey < start) return { kind: "before", daysUntilStart: daysBetween(todayKey, start) };
  if (end && todayKey > end) return null;

  // Counted the same way as the timetable's "第 N 週" label: weeks start on Monday.
  const week = weeksBetween(mondayOf(parseDateKey(start)), mondayOf(today)) + 1;
  if (!end) return { kind: "during", week, totalWeeks: null, fraction: null };
  const totalWeeks = weeksBetween(mondayOf(parseDateKey(start)), mondayOf(parseDateKey(end))) + 1;
  const fraction = (daysBetween(start, todayKey) + 1) / (daysBetween(start, end) + 1);
  return { kind: "during", week, totalWeeks, fraction: Math.min(1, Math.max(0, fraction)) };
}

/** The holiday happening today, or else the next one to come. */
export function getHolidayCountdown(schedule: Schedule, today: Date): HolidayCountdown | null {
  const todayKey = toDateKey(today);
  const next = [...(schedule.holidays ?? [])]
    .filter((holiday) => holiday.endDate >= todayKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (!next) return null;
  const { name, startDate, endDate } = next;
  if (startDate <= todayKey) return { kind: "ongoing", name, startDate, endDate };
  return { kind: "upcoming", name, startDate, endDate, days: daysBetween(todayKey, startDate) };
}
