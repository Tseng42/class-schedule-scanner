import { z } from "zod";

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
});
export type CourseEvent = z.infer<typeof courseEventSchema>;

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  teacher: z.string().optional(),
  location: z.string().optional(),
  timeSlots: z.array(timeSlotSchema).min(1),
  recurrence: recurrenceSchema,
  notes: z.string().optional(),
  cancellations: z.array(cancellationSchema).optional(),
  events: z.array(courseEventSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Course = z.infer<typeof courseSchema>;
