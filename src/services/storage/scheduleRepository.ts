import { createEmptySchedule, scheduleSchema, type Holiday, type Schedule } from "../../schema/schedule";
import type { Course } from "../../schema/course";
import { writeJSON } from "./persist";
import { generateId } from "../../lib/id";
import { requestSync } from "../sync/syncTrigger";
import { holidayKey } from "../sync/mergeSchedule";
import { isSameCourse } from "./courseIdentity";

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

function now(): string {
  return new Date().toISOString();
}

/**
 * Wholesale-replaces the schedule when restoring a backup. The restored
 * records count as edited now and everything the backup lacks counts as
 * deleted now, so the restore wins over the copies on other devices instead
 * of being merged away. Throws if `schedule` doesn't match the current shape.
 */
export function replaceSchedule(schedule: Schedule): Schedule {
  const restored = scheduleSchema.parse(schedule);
  const current = loadSchedule();
  const at = now();

  const restoredIds = new Set(restored.courses.map((course) => course.id));
  const restoredKeys = new Set((restored.holidays ?? []).map(holidayKey));
  const deletedCourses = { ...current.deletedCourses, ...restored.deletedCourses };
  for (const course of current.courses) if (!restoredIds.has(course.id)) deletedCourses[course.id] = at;
  const deletedHolidays = { ...current.deletedHolidays, ...restored.deletedHolidays };
  for (const holiday of current.holidays ?? []) {
    if (!restoredKeys.has(holidayKey(holiday))) deletedHolidays[holidayKey(holiday)] = at;
  }

  const updated: Schedule = {
    version: 1,
    courses: restored.courses.map((course) => ({ ...course, updatedAt: at })),
    holidays: (restored.holidays ?? []).map((holiday) => ({ ...holiday, updatedAt: at })),
  };
  if (Object.keys(deletedCourses).length > 0) updated.deletedCourses = deletedCourses;
  if (Object.keys(deletedHolidays).length > 0) updated.deletedHolidays = deletedHolidays;
  persist(updated);
  return updated;
}

/** Stores the result of a cloud merge. Does not request another sync — it came from one. */
export function applySyncedSchedule(schedule: Schedule): void {
  persist(scheduleSchema.parse(schedule));
}

export interface AddCoursesResult {
  schedule: Schedule;
  addedCount: number;
  skippedCount: number;
}

export function addCourses(newCourses: Course[]): AddCoursesResult {
  const current = loadSchedule();
  const toAdd = newCourses.filter((course) => !current.courses.some((existing) => isSameCourse(existing, course)));
  const updated: Schedule = { ...current, courses: [...current.courses, ...toAdd] };
  persist(updated);
  requestSync("schedule");
  return { schedule: updated, addedCount: toAdd.length, skippedCount: newCourses.length - toAdd.length };
}

export function removeCourse(courseId: string): Schedule {
  const current = loadSchedule();
  const updated: Schedule = {
    ...current,
    courses: current.courses.filter((course) => course.id !== courseId),
    deletedCourses: { ...current.deletedCourses, [courseId]: now() },
  };
  persist(updated);
  requestSync("schedule");
  return updated;
}

export function addHoliday(holiday: Holiday): Schedule {
  const current = loadSchedule();
  const updated: Schedule = { ...current, holidays: [...(current.holidays ?? []), { ...holiday, updatedAt: now() }] };
  persist(updated);
  requestSync("schedule");
  return updated;
}

export interface AddHolidaysResult {
  schedule: Schedule;
  addedCount: number;
  skippedCount: number;
}

/** Same date range as an existing holiday counts as a duplicate — safe to call repeatedly. */
export function addHolidays(candidates: { name: string; startDate: string; endDate: string }[]): AddHolidaysResult {
  const current = loadSchedule();
  const existing = current.holidays ?? [];
  const toAdd = candidates.filter(
    (candidate) => !existing.some((item) => holidayKey(item) === holidayKey(candidate)),
  );
  const at = now();
  const newHolidays: Holiday[] = toAdd.map((candidate) => ({ id: generateId(), ...candidate, updatedAt: at }));
  const updated: Schedule = { ...current, holidays: [...existing, ...newHolidays] };
  persist(updated);
  requestSync("schedule");
  return { schedule: updated, addedCount: newHolidays.length, skippedCount: candidates.length - newHolidays.length };
}

/** Removes every holiday with the same date range: that range is what identifies a holiday across devices. */
export function removeHoliday(holidayId: string): Schedule {
  const current = loadSchedule();
  const target = (current.holidays ?? []).find((holiday) => holiday.id === holidayId);
  if (!target) return current;
  const key = holidayKey(target);
  const updated: Schedule = {
    ...current,
    holidays: (current.holidays ?? []).filter((holiday) => holidayKey(holiday) !== key),
    deletedHolidays: { ...current.deletedHolidays, [key]: now() },
  };
  persist(updated);
  requestSync("schedule");
  return updated;
}

export function updateCourse(courseId: string, next: Course): Schedule {
  const current = loadSchedule();
  // Stamped here, not only by callers: the newest edit is what wins when devices sync.
  const edited: Course = { ...next, updatedAt: now() };
  const updated: Schedule = {
    ...current,
    courses: current.courses.map((course) => (course.id === courseId ? edited : course)),
  };
  persist(updated);
  requestSync("schedule");
  return updated;
}
