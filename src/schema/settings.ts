import { z } from "zod";

export const appSettingsSchema = z.object({
  reminderMinutes: z.number().int().positive().default(10),
  semesterStartDate: z.string().optional(),
  semesterEndDate: z.string().optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export function createDefaultSettings(): AppSettings {
  return { reminderMinutes: 10 };
}
