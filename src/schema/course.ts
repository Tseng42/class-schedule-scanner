import { z } from "zod";
import { generateId } from "../lib/id";

export const dayOfWeekSchema = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  MO: "週一",
  TU: "週二",
  WE: "週三",
  TH: "週四",
  FR: "週五",
  SA: "週六",
  SU: "週日",
};

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時間格式必須是 HH:mm(24小時制)");

export const timeSlotSchema = z.object({
  id: z.string(),
  dayOfWeek: dayOfWeekSchema,
  startTime: timeSchema,
  endTime: timeSchema,
});
export type TimeSlot = z.infer<typeof timeSlotSchema>;

export const recurrenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("weekly"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  z.object({
    type: z.literal("once"),
    date: z.string(),
  }),
]);
export type Recurrence = z.infer<typeof recurrenceSchema>;

/** A run of dates (inclusive) on which this course doesn't meet. A single day has endDate === startDate. */
export const cancellationSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});
export type Cancellation = z.infer<typeof cancellationSchema>;

export const eventKindSchema = z.enum(["exam", "assignment", "other"]);
export type EventKind = z.infer<typeof eventKindSchema>;

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  exam: "考試",
  assignment: "作業",
  other: "其他",
};

/** One line of an exam's 複習清單, e.g. "第 3–5 章" or "做考古題/練習題". */
export const prepItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean().optional(),
});
export type PrepItem = z.infer<typeof prepItemSchema>;

/** An exam, assignment due date, or anything else worth a reminder, tied to a course. */
export const courseEventSchema = z.object({
  id: z.string(),
  kind: eventKindSchema,
  title: z.string(),
  date: z.string(),
  /** Omitted for all-day items like an assignment due "on the 20th". */
  time: timeSchema.optional(),
  /** How long before the event to remind. Omitted means no reminder. */
  remindMinutes: z.number().int().positive().optional(),
  /** Checked off. Only assignments and other to-dos can be; an exam isn't something you finish. */
  done: z.boolean().optional(),
  /** Marked 急: listed first and shown in red. */
  urgent: z.boolean().optional(),
  /** Exams only: what to review before it. */
  checklist: z.array(prepItemSchema).optional(),
});
export type CourseEvent = z.infer<typeof courseEventSchema>;

/** A freeform note, optionally tied to a specific class date ("10/15: 帶護照"). Undated notes are general reminders. */
export const noteSchema = z.object({
  id: z.string(),
  text: z.string(),
  date: z.string().optional(),
});
export type Note = z.infer<typeof noteSchema>;

/** Older saved schedules have `notes` as a single string — migrated here into a one-item list. */
const notesField = z.preprocess((value) => {
  if (typeof value === "string") return value.trim() ? [{ id: generateId(), text: value }] : [];
  return value;
}, z.array(noteSchema).optional());

export const MAX_CREDITS = 20;

/** One part of a course's grade, e.g. 期中 at 30%. The score is filled in once it's known. */
export const gradeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Percent of the course grade. */
  weight: z.number().min(0).max(100),
  /** Out of 100; a little over for bonus points. */
  score: z.number().min(0).max(150).optional(),
});
export type GradeItem = z.infer<typeof gradeItemSchema>;

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  teacher: z.string().optional(),
  location: z.string().optional(),
  timeSlots: z.array(timeSlotSchema).min(1),
  recurrence: recurrenceSchema,
  notes: notesField,
  cancellations: z.array(cancellationSchema).optional(),
  events: z.array(courseEventSchema).optional(),
  /** 學分. 0 is real: 體育、軍訓 and the like often carry none. Absent means not filled in. */
  credits: z.number().int().min(0).max(MAX_CREDITS).optional(),
  /** 成績 parts and their weights, filled in by the student. */
  gradeItems: z.array(gradeItemSchema).optional(),
  /** A score the student is aiming for, beyond just passing. */
  targetScore: z.number().min(0).max(100).optional(),
  /** The official 學期總成績, when known; it beats anything worked out from gradeItems. */
  finalScore: z.number().min(0).max(100).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Course = z.infer<typeof courseSchema>;
