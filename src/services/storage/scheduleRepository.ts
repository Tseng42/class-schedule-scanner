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

export function addCourses(newCourses: Course[]): Schedule {
  const current = loadSchedule();
  const updated: Schedule = { ...current, courses: [...current.courses, ...newCourses] };
  persist(updated);
  return updated;
}
