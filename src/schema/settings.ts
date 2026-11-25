import { z } from "zod";

export const DEFAULT_LINE_DAILY_TIME = "07:00";
/** The minimum for a four-year bachelor's degree under 大學法施行細則; many departments ask for exactly this. */
export const DEFAULT_GRADUATION_CREDITS = 128;
export const DEFAULT_PASSING_SCORE = 60;

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
  /** Credits needed to graduate, for the progress bar on 所有課程. Absent means 128. */
  graduationCredits: z.number().int().positive().optional(),
  /** 及格線 for 成績計算. Absent means 60, the usual line for undergraduates. */
  passingScore: z.number().min(1).max(100).optional(),
  /** Monday key of the week whose 每週小回顧 card was put away; synced so it stays away on every device. */
  weeklyReviewDismissed: z.string().optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export function createDefaultSettings(): AppSettings {
  return { reminderMinutes: 10 };
}
