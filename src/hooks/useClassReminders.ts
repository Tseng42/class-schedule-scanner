import { useEffect } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { getOccurrencesForDate, type CourseOccurrence } from "../services/scheduling/nextClass";
import { scheduleReminders } from "../services/notifications/scheduleNotifications";

const MAX_LOOKAHEAD_DAYS = 20;

export function useClassReminders(schedule: Schedule, settings: AppSettings, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const now = new Date();
    // A reminder set to "N days before" fires today for a class that isn't
    // until a future day, so today's occurrences alone aren't enough — look
    // ahead far enough to cover the configured reminder lead time.
    const daysAhead = Math.min(
      MAX_LOOKAHEAD_DAYS,
      Math.max(1, Math.ceil(settings.reminderMinutes / 1440) + 1),
    );
    const occurrences: CourseOccurrence[] = [];
    for (let offset = 0; offset < daysAhead; offset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      occurrences.push(...getOccurrencesForDate(schedule, date));
    }

    return scheduleReminders(occurrences, settings.reminderMinutes, now, (occurrence) => {
      new Notification(`即將上課:${occurrence.course.name}`, {
        body: `${occurrence.timeSlot.startTime} 開始${occurrence.course.location ? ` · ${occurrence.course.location}` : ""}`,
        tag: occurrence.timeSlot.id,
      });
    });
  }, [schedule, settings, enabled]);
}
