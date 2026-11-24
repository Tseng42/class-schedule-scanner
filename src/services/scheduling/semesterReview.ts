import type { DayOfWeek } from "../../schema/course";
import type { AttendanceStatus, Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { attendanceOf, trackingStartKey } from "./attendance";
import { parseDateKey, toDateKey } from "./dateKey";
import { listEvents } from "./events";
import { getHolidayName, getOccurrencesForDate } from "./nextClass";
import { BLOCK_COLORS, DAY_ORDER, mondayOf, shiftDays, toMinutes, weeksBetween } from "./weekLayout";

/** Classes starting before this count as 早八. */
const EARLY_BEFORE = "09:00";
/** Marks that count as being there: 遲到 is only recorded, and 公假 is excused. */
const ATTENDED = new Set<AttendanceStatus>(["present", "late", "official"]);
/** The home screen starts nudging toward the review this close to the semester's end… */
const ENDING_SOON_DAYS = 14;
/** …and keeps it up through the break, but not into a semester whose dates were never updated. */
const AFTER_END_DAYS = 60;

export interface CourseTime {
  courseId: string;
  name: string;
  minutes: number;
  /** Same color slot the course has on the timetable. */
  colorIndex: number;
}

export interface AttendanceReview {
  marked: number;
  /** Share of marked classes attended, 0–1. */
  attendedRate: number;
  lateCount: number;
  /** Courses where every class so far is marked and attended. */
  perfectCourses: string[];
}

export interface SemesterReview {
  startKey: string;
  /** Last day counted: today, or the semester's last day once it's over. */
  endKey: string;
  isFinished: boolean;
  /** Semester week of `endKey`, counted from the Monday of the start week. */
  weekCount: number;
  classCount: number;
  totalMinutes: number;
  earlyCount: number;
  /** Up to three, most time first. */
  topCourses: CourseTime[];
  /** The weekday with the most class time in the weekly timetable. */
  busiestDay: { day: DayOfWeek; minutes: number } | null;
  holidayDays: number;
  /** Classes skipped because of a holiday or a cancellation. */
  skippedClasses: number;
  examCount: number;
  assignmentCount: number;
  /** Null when nothing has been marked. */
  attendance: AttendanceReview | null;
}

/**
 * Everything the semester review shows, counted from the semester's start (or the first
 * course added) through today. Only classes that have already ended count. Null when
 * there's nothing to look back on yet.
 */
export function buildSemesterReview(schedule: Schedule, settings: AppSettings, now: Date): SemesterReview | null {
  const startKey = trackingStartKey(schedule, settings);
  if (!startKey) return null;
  const todayKey = toDateKey(now);
  const end = settings.semesterEndDate;
  const isFinished = Boolean(end && todayKey > end);
  const endKey = isFinished && end ? end : todayKey;
  if (startKey > endKey) return null;

  const colorIndexByCourseId = new Map(schedule.courses.map((course, index) => [course.id, index % BLOCK_COLORS.length]));
  const minutesByCourse = new Map<string, number>();
  const perCourse = new Map<string, { name: string; meetings: number; attended: number }>();
  let classCount = 0;
  let totalMinutes = 0;
  let earlyCount = 0;
  let holidayDays = 0;
  let skippedClasses = 0;
  let marked = 0;
  let attended = 0;
  let lateCount = 0;

  for (let date = parseDateKey(startKey); toDateKey(date) <= endKey; date = shiftDays(date, 1)) {
    if (getHolidayName(schedule, toDateKey(date))) holidayDays += 1;
    for (const occurrence of getOccurrencesForDate(schedule, date, settings, true)) {
      if (occurrence.cancelledReason !== undefined) {
        skippedClasses += 1;
        continue;
      }
      if (occurrence.endAt > now) continue;

      const { course } = occurrence;
      const minutes = (occurrence.endAt.getTime() - occurrence.startAt.getTime()) / 60000;
      classCount += 1;
      totalMinutes += minutes;
      minutesByCourse.set(course.id, (minutesByCourse.get(course.id) ?? 0) + minutes);
      if (occurrence.timeSlot.startTime < EARLY_BEFORE) earlyCount += 1;

      const tally = perCourse.get(course.id) ?? { name: course.name, meetings: 0, attended: 0 };
      tally.meetings += 1;
      const status = attendanceOf(schedule, occurrence)?.status;
      if (status) {
        marked += 1;
        if (ATTENDED.has(status)) {
          attended += 1;
          tally.attended += 1;
        }
        if (status === "late") lateCount += 1;
      }
      perCourse.set(course.id, tally);
    }
  }

  const courseNames = new Map(schedule.courses.map((course) => [course.id, course.name]));
  const topCourses = [...minutesByCourse]
    .map(([courseId, minutes]) => ({
      courseId,
      name: courseNames.get(courseId) ?? "",
      minutes,
      colorIndex: colorIndexByCourseId.get(courseId) ?? 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);

  const weeklyMinutes = new Map<DayOfWeek, number>();
  for (const course of schedule.courses) {
    if (course.recurrence.type !== "weekly") continue;
    for (const slot of course.timeSlots) {
      const minutes = toMinutes(slot.endTime) - toMinutes(slot.startTime);
      weeklyMinutes.set(slot.dayOfWeek, (weeklyMinutes.get(slot.dayOfWeek) ?? 0) + minutes);
    }
  }
  const busiestDay = DAY_ORDER.reduce<SemesterReview["busiestDay"]>((best, day) => {
    const minutes = weeklyMinutes.get(day) ?? 0;
    return minutes > (best?.minutes ?? 0) ? { day, minutes } : best;
  }, null);

  const events = listEvents(schedule).filter((item) => item.event.date >= startKey && item.event.date <= endKey);

  return {
    startKey,
    endKey,
    isFinished,
    weekCount: weeksBetween(mondayOf(parseDateKey(startKey)), mondayOf(parseDateKey(endKey))) + 1,
    classCount,
    totalMinutes,
    earlyCount,
    topCourses,
    busiestDay,
    holidayDays,
    skippedClasses,
    examCount: events.filter((item) => item.event.kind === "exam").length,
    assignmentCount: events.filter((item) => item.event.kind === "assignment").length,
    attendance:
      marked === 0
        ? null
        : {
            marked,
            attendedRate: attended / marked,
            lateCount,
            perfectCourses: [...perCourse.values()]
              .filter((tally) => tally.meetings > 0 && tally.attended === tally.meetings)
              .map((tally) => tally.name),
          },
  };
}

/** In the semester's last two weeks or the break after it, the home screen points to the review. */
export function isReviewSeason(settings: AppSettings, now: Date): boolean {
  const end = settings.semesterEndDate;
  if (!end) return false;
  const daysLeft = Math.round((parseDateKey(end).getTime() - parseDateKey(toDateKey(now)).getTime()) / 86400000);
  return daysLeft < ENDING_SOON_DAYS && daysLeft >= -AFTER_END_DAYS;
}

/** "48" for whole-ish totals, "2.5" for small ones. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours >= 10 ? String(Math.round(hours)) : String(Math.round(hours * 10) / 10);
}
