import { z } from "zod";

export const DEFAULT_LINE_DAILY_TIME = "07:00";

export const appSettingsSchema = z.object({
  reminderMinutes: z.number().int().positive().default(10),
  semesterStartDate: z.string().optional(),
  semesterEndDate: z.string().optional(),
  /**
   * LINE reminders are sent by the server (api/line-notify.js), which reads
   * these from the cloud-synced copy — they do nothing unless cloud sync is on.
   */
  lineDailySummary: z.boolean().optional(),
  /** "HH:mm" Taiwan time; the server falls back to DEFAULT_LINE_DAILY_TIME. */
  lineDailyTime: z.string().optional(),
  /** Reminds `reminderMinutes` before each class. */
  lineClassReminder: z.boolean().optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export function createDefaultSettings(): AppSettings {
  return { reminderMinutes: 10 };
}
