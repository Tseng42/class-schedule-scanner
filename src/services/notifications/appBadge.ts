import type { Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { toDateKey } from "../scheduling/dateKey";
import { isTask } from "../scheduling/events";

/**
 * The red number on the home-screen icon (Badging API): to-dos due today or overdue
 * and not yet checked off. iPhone shows it from iOS 16.4 once notifications are allowed;
 * desktop Chrome and Edge show it for an installed app; Android has no numbers at all.
 * It only changes while the app is running, so a closed app keeps its last number.
 */
export function countBadgeItems(schedule: Schedule, now: Date): number {
  const todayKey = toDateKey(now);
  return schedule.courses.reduce(
    (count, course) =>
      count + (course.events ?? []).filter((event) => isTask(event) && !event.done && event.date <= todayKey).length,
    0,
  );
}

export function isAppBadgeSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

/** Sets or clears the icon number. Off in settings, or nothing due, clears it. */
export function updateAppBadge(schedule: Schedule, settings: AppSettings, now: Date): void {
  if (!isAppBadgeSupported()) return;
  const count = settings.appBadge === false ? 0 : countBadgeItems(schedule, now);
  // iOS ignores the badge without notification permission; the call itself still succeeds.
  const done = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  done.catch(() => {
    // Not installed, or the browser said no: there's just no number.
  });
}
