import { appSettingsSchema, createDefaultSettings, type AppSettings } from "../../schema/settings";
import { writeJSON } from "./persist";

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

export function saveSettings(settings: AppSettings): void {
  writeJSON(STORAGE_KEY, settings);
}

/** Validates and persists settings from an external source (e.g. a restored backup). */
export function replaceSettings(settings: AppSettings): AppSettings {
  const validated = appSettingsSchema.parse(settings);
  saveSettings(validated);
  return validated;
}
