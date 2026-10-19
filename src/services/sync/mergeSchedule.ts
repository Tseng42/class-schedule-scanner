import type { Course } from "../../schema/course";
import type { Holiday, Schedule } from "../../schema/schedule";
import { isSameCourse } from "../storage/courseIdentity";

export interface MergeOptions {
  /**
   * The first merge on a device after this sync model shipped. Before it,
   * edits never propagated, so two devices can hold different versions of one
   * course; their notes, cancellations and events are combined instead of the
   * newer version replacing the older one wholesale.
   */
  reconcileLegacy: boolean;
}

export interface MergeResult {
  schedule: Schedule;
  coursesAdded: number;
  coursesRemoved: number;
  holidaysAdded: number;
  holidaysRemoved: number;
}

type Tombstones = Record<string, string>;

/** A holiday's identity across devices is its date range: the same holiday gets a different id on each device. */
export function holidayKey(holiday: { startDate: string; endDate: string }): string {
  return `${holiday.startDate}|${holiday.endDate}`;
}

function mergeTombstones(a: Tombstones | undefined, b: Tombstones | undefined): Tombstones {
  const merged: Tombstones = { ...a };
  for (const [key, deletedAt] of Object.entries(b ?? {})) {
    if (!merged[key] || deletedAt > merged[key]) merged[key] = deletedAt;
  }
  return merged;
}

/** Keeps the first item for each key. */
function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * `primary`'s fields, plus every note, cancellation and event either version
 * has. Matches by id first, then by content, because a note migrated from the
 * old single-string format gets a fresh id on every device.
 */
function combineVersions(primary: Course, secondary: Course): Course {
  const combined: Course = {
    ...primary,
    createdAt: primary.createdAt < secondary.createdAt ? primary.createdAt : secondary.createdAt,
    updatedAt: primary.updatedAt > secondary.updatedAt ? primary.updatedAt : secondary.updatedAt,
  };
  if (primary.notes || secondary.notes) {
    combined.notes = uniqueBy(
      uniqueBy([...(primary.notes ?? []), ...(secondary.notes ?? [])], (note) => note.id),
      (note) => `${note.date ?? ""}|${note.text.trim()}`,
    );
  }
  if (primary.cancellations || secondary.cancellations) {
    combined.cancellations = uniqueBy(
      [...(primary.cancellations ?? []), ...(secondary.cancellations ?? [])],
      (item) => `${item.startDate}|${item.endDate}`,
    );
  }
  if (primary.events || secondary.events) {
    combined.events = uniqueBy(
      uniqueBy([...(primary.events ?? []), ...(secondary.events ?? [])], (event) => event.id),
      (event) => `${event.kind}|${event.title.trim()}|${event.date}|${event.time ?? ""}`,
    );
  }
  return combined;
}

/** The later-edited version; on a tie, `preferOnTie`. */
function newer(a: Course, b: Course, preferOnTie: Course): Course {
  if (a.updatedAt === b.updatedAt) return preferOnTie;
  return a.updatedAt > b.updatedAt ? a : b;
}

function mergeCourses(local: Course[], cloud: Course[], tombstones: Tombstones, options: MergeOptions): Course[] {
  // 1. One entry per id. The later edit wins; a tie goes to the cloud copy, the one every device shares.
  //    Cloud records go in first so every device ends up with the cloud's order, then its own new ones.
  const byId = new Map<string, Course>();
  const put = (incoming: Course) => {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      return;
    }
    const winner = newer(existing, incoming, existing);
    const loser = winner === existing ? incoming : existing;
    byId.set(incoming.id, options.reconcileLegacy ? combineVersions(winner, loser) : winner);
  };
  for (const course of cloud) put(course);
  for (const course of local) put(course);

  // 2. A deletion wins over every edit made before it.
  const alive = [...byId.values()].filter((course) => {
    const deletedAt = tombstones[course.id];
    return !deletedAt || course.updatedAt > deletedAt;
  });

  // 3. Different ids for the same class (each device added it on its own) collapse into one record.
  //    The surviving id is the smaller one so every device converges on the same record.
  const kept: Course[] = [];
  for (const course of alive) {
    const index = kept.findIndex((other) => isSameCourse(other, course));
    if (index === -1) {
      kept.push(course);
      continue;
    }
    const other = kept[index];
    const survivorId = other.id < course.id ? other.id : course.id;
    const primary = newer(other, course, other.id === survivorId ? other : course);
    const secondary = primary === other ? course : other;
    kept[index] = { ...combineVersions(primary, secondary), id: survivorId };
  }
  return kept;
}

function mergeHolidays(local: Holiday[], cloud: Holiday[], tombstones: Tombstones): Holiday[] {
  const byKey = new Map<string, Holiday>();
  for (const holiday of [...cloud, ...local]) {
    const key = holidayKey(holiday);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, holiday);
      continue;
    }
    const existingAt = existing.updatedAt ?? "";
    const incomingAt = holiday.updatedAt ?? "";
    const incomingWins = incomingAt === existingAt ? holiday.id < existing.id : incomingAt > existingAt;
    if (incomingWins) byKey.set(key, holiday);
  }
  return [...byKey.values()].filter((holiday) => {
    const deletedAt = tombstones[holidayKey(holiday)];
    return !deletedAt || (holiday.updatedAt ?? "") > deletedAt;
  });
}

/**
 * Combines this device's schedule with the cloud copy, record by record:
 * every course and holiday either side has is kept, the later edit of a
 * record wins, and a deletion (kept as a tombstone) removes the record
 * everywhere unless it was edited again afterwards. Pure: the caller stores
 * the result.
 */
export function mergeSchedules(local: Schedule, cloud: Schedule, options: MergeOptions): MergeResult {
  const deletedCourses = mergeTombstones(local.deletedCourses, cloud.deletedCourses);
  const deletedHolidays = mergeTombstones(local.deletedHolidays, cloud.deletedHolidays);
  const courses = mergeCourses(local.courses, cloud.courses, deletedCourses, options);
  const holidays = mergeHolidays(local.holidays ?? [], cloud.holidays ?? [], deletedHolidays);

  const schedule: Schedule = { version: 1, courses };
  if (holidays.length > 0 || local.holidays || cloud.holidays) schedule.holidays = holidays;
  if (Object.keys(deletedCourses).length > 0) schedule.deletedCourses = deletedCourses;
  if (Object.keys(deletedHolidays).length > 0) schedule.deletedHolidays = deletedHolidays;

  const localCourseIds = new Set(local.courses.map((course) => course.id));
  const resultCourseIds = new Set(courses.map((course) => course.id));
  const localHolidayKeys = new Set((local.holidays ?? []).map(holidayKey));
  const resultHolidayKeys = new Set(holidays.map(holidayKey));
  const survivingLocalIds = [...localCourseIds].filter((id) => resultCourseIds.has(id)).length;
  const survivingLocalKeys = [...localHolidayKeys].filter((key) => resultHolidayKeys.has(key)).length;

  return {
    schedule,
    coursesAdded: [...resultCourseIds].filter((id) => !localCourseIds.has(id)).length,
    // Counted per entry, so two local copies sharing one id that collapse into one count as a removal.
    coursesRemoved: local.courses.length - survivingLocalIds,
    holidaysAdded: [...resultHolidayKeys].filter((key) => !localHolidayKeys.has(key)).length,
    holidaysRemoved: (local.holidays ?? []).length - survivingLocalKeys,
  };
}
