import { z } from "zod";
import { courseSchema } from "./course";

/** A school-wide no-class period (national holiday etc.), inclusive of both dates. */
export const holidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  /** When it was added on some device. Absent on holidays saved before deletions synced. */
  updatedAt: z.string().optional(),
});
export type Holiday = z.infer<typeof holidaySchema>;

/** 公假 (official leave) doesn't count toward the 扣考 limit; 遲到 is only recorded. */
export const attendanceStatusSchema = z.enum(["present", "late", "leave", "official", "absent"]);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export const attendanceRecordSchema = z.object({
  status: attendanceStatusSchema,
  /** When it was marked; the later mark wins when devices sync. */
  updatedAt: z.string(),
});
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

/** One stretch of 專注計時. Never edited after it's logged, so syncing just keeps every one. */
export const focusSessionSchema = z.object({
  /** Absent when the timer wasn't tied to a course. */
  courseId: z.string().optional(),
  startedAt: z.string(),
  minutes: z.number().int().positive(),
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

/**
 * A semester put away by 換學期: everything its review needs, frozen. Read-only —
 * it can be looked back on and shared, never restored or edited.
 */
export const pastSemesterSchema = z.object({
  id: z.string(),
  /** The semester's dates as set when it was put away; absent if they never were. */
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  archivedAt: z.string(),
  courses: z.array(courseSchema),
  attendance: z.record(z.string(), attendanceRecordSchema).optional(),
  holidays: z.array(holidaySchema).optional(),
});
export type PastSemester = z.infer<typeof pastSemesterSchema>;

export const scheduleSchema = z.object({
  version: z.literal(1),
  courses: z.array(courseSchema),
  holidays: z.array(holidaySchema).optional(),
  /**
   * Deleted course id → when it was deleted. Kept so a deletion reaches the
   * other devices instead of their old copy bringing the course back.
   */
  deletedCourses: z.record(z.string(), z.string()).optional(),
  /** Deleted holiday date range (see holidayKey) → when. Keyed by range because holiday ids differ per device. */
  deletedHolidays: z.record(z.string(), z.string()).optional(),
  /** One class meeting ("dateKey|courseId|slotId", see attendanceKey) → how it was marked. */
  attendance: z.record(z.string(), attendanceRecordSchema).optional(),
  /** Session id (see focusSessionId) → the session. */
  focusSessions: z.record(z.string(), focusSessionSchema).optional(),
  /** Semester id → the semester, put away by 換學期. Never edited, so syncing just keeps every one. */
  pastSemesters: z.record(z.string(), pastSemesterSchema).optional(),
  /**
   * When 換學期 last ran. Attendance marked before it belongs to the old semester, so
   * other devices drop their copies of it instead of syncing it back.
   */
  semesterSwitchedAt: z.string().optional(),
});
export type Schedule = z.infer<typeof scheduleSchema>;

export function createEmptySchedule(): Schedule {
  return { version: 1, courses: [] };
}
