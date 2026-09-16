import { appSettingsSchema, createDefaultSettings, type AppSettings } from "../../schema/settings";

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
