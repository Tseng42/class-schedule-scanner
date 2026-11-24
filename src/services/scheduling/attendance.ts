import { DAY_OF_WEEK_LABELS, type Course, type TimeSlot } from "../../schema/course";
import type { AttendanceRecord, AttendanceStatus, Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { parseDateKey, toDateKey } from "./dateKey";
import { getOccurrencesForDate, type CourseOccurrence } from "./nextClass";
import { shiftDays, toMinutes } from "./weekLayout";

export const ATTENDANCE_OPTIONS: { status: AttendanceStatus; label: string; badge: string }[] = [
  { status: "present", label: "有到", badge: "✓" },
  { status: "late", label: "遲到", badge: "遲" },
  { status: "leave", label: "請假", badge: "假" },
  { status: "official", label: "公假", badge: "公" },
  { status: "absent", label: "沒去", badge: "✗" },
];

export const ATTENDANCE_LABELS = Object.fromEntries(
  ATTENDANCE_OPTIONS.map((option) => [option.status, option.label]),
) as Record<AttendanceStatus, string>;

export const ATTENDANCE_BADGES = Object.fromEntries(
  ATTENDANCE_OPTIONS.map((option) => [option.status, option.badge]),
) as Record<AttendanceStatus, string>;

/** Counted toward the 扣考 limit. 遲到 is only recorded and 公假 is excused, as at most schools. */
const MISSED_STATUSES = new Set<AttendanceStatus>(["leave", "absent"]);

const LIMIT_FRACTIONS = { third: 1 / 3, half: 1 / 2, none: null } as const;

/** Identifies one class meeting; the same key the reminders use. */
export function attendanceKey(occurrence: CourseOccurrence): string {
  return `${occurrence.dateKey}|${occurrence.course.id}|${occurrence.timeSlot.id}`;
}

export function attendanceOf(schedule: Schedule, occurrence: CourseOccurrence): AttendanceRecord | undefined {
  return schedule.attendance?.[attendanceKey(occurrence)];
}

/** "今天 13:10–16:00", "昨天 …" or "11/20 週五 …". */
export function describeMeeting(occurrence: CourseOccurrence, now: Date): string {
  const time = `${occurrence.timeSlot.startTime}–${occurrence.timeSlot.endTime}`;
  const todayKey = toDateKey(now);
  if (occurrence.dateKey === todayKey) return `今天 ${time}`;
  if (occurrence.dateKey === toDateKey(shiftDays(now, -1))) return `昨天 ${time}`;
  const date = parseDateKey(occurrence.dateKey);
  return `${date.getMonth() + 1}/${date.getDate()} ${DAY_OF_WEEK_LABELS[occurrence.timeSlot.dayOfWeek]} ${time}`;
}

/** Class periods (節) in one meeting, the unit schools count absences in: 13:10–16:00 is 3. */
export function periodsOf(slot: TimeSlot): number {
  return Math.max(1, Math.round((toMinutes(slot.endTime) - toMinutes(slot.startTime)) / 60));
}

/** Every meeting from `fromKey` through `toKey`, oldest first. Cancelled ones and holidays are left out. */
function occurrencesBetween(schedule: Schedule, settings: AppSettings, fromKey: string, toKey: string): CourseOccurrence[] {
  const occurrences: CourseOccurrence[] = [];
  for (let date = parseDateKey(fromKey); toDateKey(date) <= toKey; date = shiftDays(date, 1)) {
    occurrences.push(...getOccurrencesForDate(schedule, date, settings));
  }
  return occurrences;
}

/** The semester's first day, or else the day the earliest course was added. */
export function trackingStartKey(schedule: Schedule, settings: AppSettings): string | null {
  if (settings.semesterStartDate) return settings.semesterStartDate;
  const earliest = schedule.courses.map((course) => course.createdAt).sort()[0];
  return earliest ? toDateKey(new Date(earliest)) : null;
}

/** Classes that have ended but haven't been marked yet, most recent first. */
export function listUnmarkedClasses(schedule: Schedule, settings: AppSettings, now: Date): CourseOccurrence[] {
  const startKey = trackingStartKey(schedule, settings);
  const todayKey = toDateKey(now);
  if (!startKey || startKey > todayKey) return [];
  return occurrencesBetween(schedule, settings, startKey, todayKey)
    .filter((occurrence) => occurrence.endAt <= now && !attendanceOf(schedule, occurrence))
    .reverse();
}

export interface AttendanceSummary {
  missedPeriods: number;
  lateCount: number;
  /** Missing this many periods bars the final exam; null without both semester dates or with no limit set. */
  limitPeriods: number | null;
  /** Periods that can still be missed while staying under the limit; negative once it's reached. */
  remainingPeriods: number | null;
  /** Periods this course meets per week. */
  weeklyPeriods: number;
}

export function summarizeAttendance(schedule: Schedule, settings: AppSettings, course: Course): AttendanceSummary {
  const courseOnly: Schedule = { ...schedule, courses: [course] };
  const weeklyPeriods = course.timeSlots.reduce((sum, slot) => sum + periodsOf(slot), 0);
  const startKey = trackingStartKey(schedule, settings);
  const endKey = settings.semesterEndDate ?? toDateKey(new Date());

  let missedPeriods = 0;
  let lateCount = 0;
  let totalPeriods = 0;
  if (startKey && startKey <= endKey) {
    for (const occurrence of occurrencesBetween(courseOnly, settings, startKey, endKey)) {
      const periods = periodsOf(occurrence.timeSlot);
      totalPeriods += periods;
      const status = attendanceOf(schedule, occurrence)?.status;
      if (status && MISSED_STATUSES.has(status)) missedPeriods += periods;
      if (status === "late") lateCount += 1;
    }
  }

  const fraction = LIMIT_FRACTIONS[settings.attendanceLimit ?? "third"];
  const hasWholeSemester = Boolean(settings.semesterStartDate && settings.semesterEndDate);
  // "缺課達三分之一" means reaching the fraction counts, so the limit is the first whole period at or above it.
  const limitPeriods = fraction !== null && hasWholeSemester && totalPeriods > 0 ? Math.ceil(totalPeriods * fraction) : null;
  return {
    missedPeriods,
    lateCount,
    limitPeriods,
    remainingPeriods: limitPeriods === null ? null : limitPeriods - 1 - missedPeriods,
    weeklyPeriods,
  };
}

/** Courses that one more week of absences would push to the limit, or that are already past it. */
export function listCoursesNearLimit(
  schedule: Schedule,
  settings: AppSettings,
  today: Date,
): { course: Course; summary: AttendanceSummary }[] {
  if (settings.semesterEndDate && toDateKey(today) > settings.semesterEndDate) return [];
  return schedule.courses
    .map((course) => ({ course, summary: summarizeAttendance(schedule, settings, course) }))
    .filter(({ summary }) => summary.remainingPeriods !== null && summary.remainingPeriods < summary.weeklyPeriods);
}
