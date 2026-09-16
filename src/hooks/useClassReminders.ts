import { useEffect } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { getOccurrencesForDate } from "../services/scheduling/nextClass";
import { scheduleReminders } from "../services/notifications/scheduleNotifications";

export function useClassReminders(schedule: Schedule, settings: AppSettings, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const now = new Date();
    const occurrences = getOccurrencesForDate(schedule, now);

    return scheduleReminders(occurrences, settings.reminderMinutes, now, (occurrence) => {
      new Notification(`即將上課:${occurrence.course.name}`, {
        body: `${occurrence.timeSlot.startTime} 開始${occurrence.course.location ? ` · ${occurrence.course.location}` : ""}`,
        tag: occurrence.timeSlot.id,
      });
    });
  }, [schedule, settings, enabled]);
}
