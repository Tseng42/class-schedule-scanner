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
  /** Share of a course's periods that, once missed, bars the final exam (扣考). Absent means a third. */
  attendanceLimit: z.enum(["third", "half", "none"]).optional(),
  /** Color theme for the whole app (see lib/theme.ts). Absent means the original one. */
  theme: z.enum(["original", "morandi", "ocean", "sunset", "candy"]).optional(),
  /** 專注計時 lengths last used, in minutes. Absent means 25 / 5 / 15. */
  focusMinutes: z.number().int().positive().optional(),
  breakMinutes: z.number().int().positive().optional(),
  longBreakMinutes: z.number().int().positive().optional(),
  /** Red number on the home-screen icon for to-dos due today or overdue. Absent means on. */
  appBadge: z.boolean().optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export function createDefaultSettings(): AppSettings {
  return { reminderMinutes: 10 };
}
