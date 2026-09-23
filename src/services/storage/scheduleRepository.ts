import { createEmptySchedule, scheduleSchema, type Holiday, type Schedule } from "../../schema/schedule";
import type { Course, Recurrence } from "../../schema/course";
import { writeJSON } from "./persist";

const STORAGE_KEY = "class-schedule-scanner:schedule";

export function loadSchedule(): Schedule {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySchedule();
    return scheduleSchema.parse(JSON.parse(raw));
  } catch {
    return createEmptySchedule();
  }
}

function persist(schedule: Schedule): void {
  writeJSON(STORAGE_KEY, schedule);
}

/** Wholesale-replaces the schedule, e.g. when restoring a backup. Throws if `schedule` doesn't match the current shape. */
export function replaceSchedule(schedule: Schedule): Schedule {
  const validated = scheduleSchema.parse(schedule);
  persist(validated);
  return validated;
}

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

/** Same course name + recurrence + at least one identical time slot counts as a duplicate. */
function isDuplicate(existing: Course[], candidate: Course): boolean {
  const normalizedName = candidate.name.trim().toLowerCase();
  return existing.some(
    (course) =>
      course.name.trim().toLowerCase() === normalizedName &&
      sameRecurrence(course.recurrence, candidate.recurrence) &&
      course.timeSlots.some((slot) =>
        candidate.timeSlots.some(
          (candidateSlot) =>
            slot.dayOfWeek === candidateSlot.dayOfWeek &&
            slot.startTime === candidateSlot.startTime &&
            slot.endTime === candidateSlot.endTime,
        ),
      ),
  );
}

export interface AddCoursesResult {
  schedule: Schedule;
  addedCount: number;
  skippedCount: number;
}

export function addCourses(newCourses: Course[]): AddCoursesResult {
  const current = loadSchedule();
  const toAdd = newCourses.filter((course) => !isDuplicate(current.courses, course));
  const updated: Schedule = { ...current, courses: [...current.courses, ...toAdd] };
  persist(updated);
  return { schedule: updated, addedCount: toAdd.length, skippedCount: newCourses.length - toAdd.length };
}

export function removeCourse(courseId: string): Schedule {
  const current = loadSchedule();
  const updated: Schedule = { ...current, courses: current.courses.filter((course) => course.id !== courseId) };
  persist(updated);
  return updated;
}

export function addHoliday(holiday: Holiday): Schedule {
  const current = loadSchedule();
  const updated: Schedule = { ...current, holidays: [...(current.holidays ?? []), holiday] };
  persist(updated);
  return updated;
}

export function removeHoliday(holidayId: string): Schedule {
  const current = loadSchedule();
  const updated: Schedule = {
    ...current,
    holidays: (current.holidays ?? []).filter((holiday) => holiday.id !== holidayId),
  };
  persist(updated);
  return updated;
}

export function updateCourse(courseId: string, next: Course): Schedule {
  const current = loadSchedule();
  const updated: Schedule = {
    ...current,
    courses: current.courses.map((course) => (course.id === courseId ? next : course)),
  };
  persist(updated);
  return updated;
}
