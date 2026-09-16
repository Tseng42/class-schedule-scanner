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

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  teacher: z.string().optional(),
  location: z.string().optional(),
  timeSlots: z.array(timeSlotSchema).min(1),
  recurrence: recurrenceSchema,
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Course = z.infer<typeof courseSchema>;
