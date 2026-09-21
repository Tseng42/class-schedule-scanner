import { z } from "zod";
import { courseSchema } from "./course";

/** A school-wide no-class period (national holiday etc.), inclusive of both dates. */
export const holidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});
export type Holiday = z.infer<typeof holidaySchema>;

export const scheduleSchema = z.object({
  version: z.literal(1),
  courses: z.array(courseSchema),
  holidays: z.array(holidaySchema).optional(),
});
export type Schedule = z.infer<typeof scheduleSchema>;

export function createEmptySchedule(): Schedule {
  return { version: 1, courses: [] };
}
