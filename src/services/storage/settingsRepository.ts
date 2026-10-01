import { appSettingsSchema, createDefaultSettings, type AppSettings } from "../../schema/settings";
import { writeJSON } from "./persist";
import { requestSync } from "../sync/syncTrigger";

const STORAGE_KEY = "class-schedule-scanner:settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return appSettingsSchema.parse(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

function persist(settings: AppSettings): void {
  writeJSON(STORAGE_KEY, settings);
}

export function saveSettings(settings: AppSettings): void {
  persist(settings);
  requestSync("settings");
}

/** Validates and persists settings from an external source (e.g. a restored backup). Does not itself request a sync — the caller (e.g. restoreBackup) decides. */
export function replaceSettings(settings: AppSettings): AppSettings {
  const validated = appSettingsSchema.parse(settings);
  persist(validated);
  return validated;
}
