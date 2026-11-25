import {
  createEmptySchedule,
  scheduleSchema,
  type AttendanceStatus,
  type FocusSession,
  type Holiday,
  type PastSemester,
  type Schedule,
} from "../../schema/schedule";
import type { Course, CourseEvent } from "../../schema/course";
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
  if (restored.attendance) {
    updated.attendance = Object.fromEntries(
      Object.entries(restored.attendance).map(([key, record]) => [key, { ...record, updatedAt: at }]),
    );
  }
  // Sessions are merged by keeping every one, so a restore can add them back but never remove any.
  if (current.focusSessions || restored.focusSessions) {
    updated.focusSessions = { ...current.focusSessions, ...restored.focusSessions };
  }
  // Past semesters are kept the same way: syncing would bring back any a restore left out.
  if (current.pastSemesters || restored.pastSemesters) {
    updated.pastSemesters = { ...current.pastSemesters, ...restored.pastSemesters };
  }
  // Badges are kept for good, so a restore only ever adds them.
  if (current.achievements || restored.achievements) {
    updated.achievements = { ...restored.achievements, ...current.achievements };
  }
  const switchedAt = [current.semesterSwitchedAt, restored.semesterSwitchedAt].filter(Boolean).sort().pop();
  if (switchedAt) updated.semesterSwitchedAt = switchedAt;
  persist(updated);
  return updated;
}

/**
 * Fills in a past semester's course credits or 學期總成績: the only things a past semester
 * lets you change. An undefined value clears that field.
 */
export function setPastCourseFields(
  semesterId: string,
  courseId: string,
  patch: { credits?: number; finalScore?: number },
): Schedule {
  const current = loadSchedule();
  const semester = current.pastSemesters?.[semesterId];
  if (!semester) throw new Error("找不到這個學期");
  const courses = semester.courses.map((course) => {
    if (course.id !== courseId) return course;
    const next: Course = { ...course, ...patch };
    for (const key of ["credits", "finalScore"] as const) {
      if (key in patch && patch[key] === undefined) delete next[key];
    }
    return next;
  });
  const updated: Schedule = {
    ...current,
    pastSemesters: { ...current.pastSemesters, [semesterId]: { ...semester, courses, updatedAt: now() } },
  };
  persist(updated);
  requestSync("schedule");
  return updated;
}

/** Records newly earned badge levels. Ones already earned keep their original date. */
export function recordAchievements(keys: string[]): Schedule {
  const current = loadSchedule();
  const at = now();
  const achievements = { ...current.achievements };
  for (const key of keys) achievements[key] ??= at;
  const updated: Schedule = { ...current, achievements };
  persist(updated);
  requestSync("schedule");
  return updated;
}

export interface SwitchSemesterInput {
  /** Courses carried into the new semester, with only their name, teacher, room and times. */
  keepCourseIds: string[];
  /** The semester being put away, as set in settings. */
  oldStartDate?: string;
  oldEndDate?: string;
}

/**
 * 換學期: puts the whole current semester away as a read-only past semester, then starts
 * the new one with only the kept courses, stripped back to name, teacher, room and times.
 * Every other course and all attendance are cleared; holidays and focus sessions stay.
 */
export function switchSemester({ keepCourseIds, oldStartDate, oldEndDate }: SwitchSemesterInput): Schedule {
  const current = loadSchedule();
  const at = now();
  const keep = new Set(keepCourseIds);

  const past: PastSemester = { id: generateId(), archivedAt: at, courses: current.courses };
  if (oldStartDate) past.startDate = oldStartDate;
  if (oldEndDate) past.endDate = oldEndDate;
  if (current.attendance && Object.keys(current.attendance).length > 0) past.attendance = current.attendance;
  if (current.holidays && current.holidays.length > 0) past.holidays = current.holidays;

  const deletedCourses = { ...current.deletedCourses };
  const courses: Course[] = [];
  for (const course of current.courses) {
    if (!keep.has(course.id)) {
      deletedCourses[course.id] = at;
      continue;
    }
    const carried: Course = {
      id: course.id,
      name: course.name,
      timeSlots: course.timeSlots,
      recurrence: { type: "weekly" },
      createdAt: course.createdAt,
      updatedAt: at,
    };
    if (course.teacher) carried.teacher = course.teacher;
    if (course.credits !== undefined) carried.credits = course.credits;
    if (course.location) carried.location = course.location;
    courses.push(carried);
  }

  const updated: Schedule = {
    ...current,
    courses,
    deletedCourses,
    attendance: {},
    pastSemesters: { ...current.pastSemesters, [past.id]: past },
    semesterSwitchedAt: at,
  };
  persist(updated);
  requestSync("schedule");
  return updated;
}

/** Logs a stretch of 專注計時. Logging the same id twice (two open tabs) keeps one. */
export function addFocusSession(id: string, session: FocusSession): Schedule {
  const current = loadSchedule();
  const updated: Schedule = { ...current, focusSessions: { ...current.focusSessions, [id]: session } };
  persist(updated);
  requestSync("schedule");
  return updated;
}

/** Marks one class meeting (see attendanceKey) as attended, late, on leave or missed. */
export function setAttendance(key: string, status: AttendanceStatus): Schedule {
  const current = loadSchedule();
  const updated: Schedule = {
    ...current,
    attendance: { ...current.attendance, [key]: { status, updatedAt: now() } },
  };
  persist(updated);
  requestSync("schedule");
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
  // Also skips one starting the same day under the same name: the 2026 list used to
  // end with a one-day 2027 元旦 that the 2027 list now covers as 1/1–1/3.
  const toAdd = candidates.filter(
    (candidate) =>
      !existing.some(
        (item) =>
          holidayKey(item) === holidayKey(candidate) ||
          (item.startDate === candidate.startDate && item.name === candidate.name),
      ),
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

/** Checks off an assignment, flags it 急 or edits an exam's 複習清單, as a course edit so it syncs like one. */
export function updateCourseEvent(
  courseId: string,
  eventId: string,
  patch: Partial<Pick<CourseEvent, "done" | "urgent" | "checklist">>,
): Schedule {
  const course = loadSchedule().courses.find((item) => item.id === courseId);
  if (!course) throw new Error("找不到這門課");
  const events = (course.events ?? []).map((event) => (event.id === eventId ? { ...event, ...patch } : event));
  return updateCourse(courseId, { ...course, events });
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
