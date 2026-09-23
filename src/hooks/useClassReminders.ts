import { useEffect } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { EVENT_KIND_LABELS } from "../schema/course";
import { getOccurrencesForDate, type CourseOccurrence } from "../services/scheduling/nextClass";
import { listEvents } from "../services/scheduling/events";
import { scheduleEventReminders, scheduleReminders } from "../services/notifications/scheduleNotifications";

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
      occurrences.push(...getOccurrencesForDate(schedule, date, settings));
    }

    const cancelClassReminders = scheduleReminders(occurrences, settings.reminderMinutes, now, (occurrence) => {
      new Notification(`即將上課:${occurrence.course.name}`, {
        body: `${occurrence.timeSlot.startTime} 開始${occurrence.course.location ? ` · ${occurrence.course.location}` : ""}`,
        tag: occurrence.timeSlot.id,
      });
    });

    const cancelEventReminders = scheduleEventReminders(listEvents(schedule), now, (item) => {
      new Notification(`${EVENT_KIND_LABELS[item.event.kind]}提醒:${item.event.title || item.course.name}`, {
        body: `${item.course.name} · ${item.event.date}${item.allDay ? "" : ` ${item.event.time}`}`,
        tag: item.event.id,
      });
    });

    return () => {
      cancelClassReminders();
      cancelEventReminders();
    };
  }, [schedule, settings, enabled]);
}
