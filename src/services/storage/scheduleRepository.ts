import { createEmptySchedule, scheduleSchema, type Schedule } from "../../schema/schedule";
import type { Course } from "../../schema/course";

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

/** Same course name + at least one identical time slot counts as a duplicate. */
function isDuplicate(existing: Course[], candidate: Course): boolean {
  const normalizedName = candidate.name.trim().toLowerCase();
  return existing.some(
    (course) =>
      course.name.trim().toLowerCase() === normalizedName &&
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

export function updateCourse(courseId: string, next: Course): Schedule {
  const current = loadSchedule();
  const updated: Schedule = {
    ...current,
    courses: current.courses.map((course) => (course.id === courseId ? next : course)),
  };
  persist(updated);
  return updated;
}
