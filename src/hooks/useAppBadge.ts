import { useEffect } from "react";
import { updateAppBadge } from "../services/notifications/appBadge";
import { STORAGE_CHANGED_EVENT } from "../services/storage/persist";
import { loadSchedule } from "../services/storage/scheduleRepository";
import { loadSettings } from "../services/storage/settingsRepository";

/** How often to recount while open, so the number moves on at midnight. */
const RECOUNT_MS = 60_000;

/**
 * Keeps the home-screen icon's red number in step while the app runs: on open, on
 * coming back to the foreground, after anything is saved (a tick, a sync, a setting)
 * and once a minute for the date rolling over.
 */
export function useAppBadge(): void {
  useEffect(() => {
    const refresh = () => updateAppBadge(loadSchedule(), loadSettings(), new Date());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener(STORAGE_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, RECOUNT_MS);
    return () => {
      window.removeEventListener(STORAGE_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);
}
