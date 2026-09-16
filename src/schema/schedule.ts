import { z } from "zod";
import { courseSchema } from "./course";

export const scheduleSchema = z.object({
  version: z.literal(1),
  courses: z.array(courseSchema),
});
export type Schedule = z.infer<typeof scheduleSchema>;

export function createEmptySchedule(): Schedule {
  return { version: 1, courses: [] };
}
