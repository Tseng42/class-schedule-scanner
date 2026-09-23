import { z } from "zod";
import { scheduleSchema, type Schedule } from "../../schema/schedule";
import { appSettingsSchema, type AppSettings } from "../../schema/settings";
import { loadSchedule, replaceSchedule } from "./scheduleRepository";
import { loadSettings, replaceSettings } from "./settingsRepository";

const backupSchema = z.object({
  backupVersion: z.literal(1),
  exportedAt: z.string(),
  schedule: scheduleSchema,
  settings: appSettingsSchema,
});
export type Backup = z.infer<typeof backupSchema>;

export function createBackup(): Backup {
  return {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    schedule: loadSchedule(),
    settings: loadSettings(),
  };
}

export class InvalidBackupError extends Error {
  constructor() {
    super("備份檔案格式不正確或已損毀");
    this.name = "InvalidBackupError";
  }
}

/** Validates `raw` as a backup and overwrites the current schedule + settings with it. */
export function restoreBackup(raw: unknown): { schedule: Schedule; settings: AppSettings } {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidBackupError();
  return {
    schedule: replaceSchedule(parsed.data.schedule),
    settings: replaceSettings(parsed.data.settings),
  };
}
