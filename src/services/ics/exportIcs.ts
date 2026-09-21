import { createEvents, type DateArray, type EventAttributes } from "ics";
import { EVENT_KIND_LABELS, type DayOfWeek } from "../../schema/course";
import type { Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { addDays, dayOfWeekOf, toDateKey } from "../scheduling/dateKey";
import { getCancellationReason } from "../scheduling/nextClass";
import { listEvents } from "../scheduling/events";

const DEFAULT_RANGE_WEEKS = 16;

/** Stable IDs so re-importing an updated file replaces events in calendar apps instead of duplicating them. */
const uidFor = (id: string) => `${id}@class-schedule-scanner`;

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function firstOccurrenceOnOrAfter(startDateKey: string, dayOfWeek: DayOfWeek): string {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = addDays(startDateKey, offset);
    if (dayOfWeekOf(candidate) === dayOfWeek) return candidate;
  }
  return startDateKey;
}

function toDateArray(dateKey: string, time: string): [number, number, number, number, number] {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return [year, month, day, hour, minute];
}

function dateToArray(date: Date): [number, number, number, number, number] {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
}

/**
 * RFC 5545 requires UNTIL to have the same value type as DTSTART. The `ics`
 * library's default is inputType "local" / outputType "utc" — it treats our
 * DateArray as local wall-clock time and converts it to a UTC `...Z` DTSTART.
 * UNTIL has to go through the same local-to-UTC conversion by hand.
 */
function formatUntil(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const localEndOfDay = new Date(year, month - 1, day, 23, 59, 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${localEndOfDay.getUTCFullYear()}${pad(localEndOfDay.getUTCMonth() + 1)}${pad(localEndOfDay.getUTCDate())}` +
    `T${pad(localEndOfDay.getUTCHours())}${pad(localEndOfDay.getUTCMinutes())}${pad(localEndOfDay.getUTCSeconds())}Z`
  );
}

export function scheduleToIcsEvents(schedule: Schedule, settings: AppSettings): EventAttributes[] {
  const today = toDateKey(new Date());
  const defaultRangeStart = today;
  const defaultRangeEnd = addDays(today, DEFAULT_RANGE_WEEKS * 7);

  const events: EventAttributes[] = [];

  for (const course of schedule.courses) {
    const description = course.teacher ? `教師:${course.teacher}` : undefined;

    for (const slot of course.timeSlots) {
      const durationMinutes = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);

      if (course.recurrence.type === "once") {
        if (getCancellationReason(schedule, course, course.recurrence.date)) continue;
        events.push({
          uid: uidFor(slot.id),
          title: course.name,
          location: course.location,
          description,
          start: toDateArray(course.recurrence.date, slot.startTime),
          duration: { minutes: durationMinutes },
          alarms: [
            { action: "display", description: course.name, trigger: { minutes: settings.reminderMinutes, before: true } },
          ],
        });
        continue;
      }

      const effectiveStart = course.recurrence.startDate ?? settings.semesterStartDate ?? defaultRangeStart;
      const effectiveEnd = course.recurrence.endDate ?? settings.semesterEndDate ?? defaultRangeEnd;
      const firstDate = firstOccurrenceOnOrAfter(effectiveStart, slot.dayOfWeek);
      if (firstDate > effectiveEnd) continue;

      const exclusionDates: DateArray[] = [];
      for (let dateKey = firstDate; dateKey <= effectiveEnd; dateKey = addDays(dateKey, 7)) {
        if (getCancellationReason(schedule, course, dateKey)) {
          exclusionDates.push(toDateArray(dateKey, slot.startTime));
        }
      }

      events.push({
        uid: uidFor(slot.id),
        title: course.name,
        location: course.location,
        description,
        start: toDateArray(firstDate, slot.startTime),
        duration: { minutes: durationMinutes },
        recurrenceRule: `FREQ=WEEKLY;BYDAY=${slot.dayOfWeek};UNTIL=${formatUntil(effectiveEnd)}`,
        ...(exclusionDates.length > 0 ? { exclusionDates } : {}),
        alarms: [
          { action: "display", description: course.name, trigger: { minutes: settings.reminderMinutes, before: true } },
        ],
      });
    }
  }

  const todayKey = toDateKey(new Date());
  for (const item of listEvents(schedule)) {
    if (item.event.date < todayKey) continue;
    const title = `${EVENT_KIND_LABELS[item.event.kind]}:${item.event.title || EVENT_KIND_LABELS[item.event.kind]}`;
    const alarms = item.fireAt
      ? { alarms: [{ action: "display" as const, description: title, trigger: dateToArray(item.fireAt) }] }
      : {};
    if (item.allDay) {
      const nextDay = new Date(item.startAt.getFullYear(), item.startAt.getMonth(), item.startAt.getDate() + 1);
      events.push({
        uid: uidFor(item.event.id),
        title,
        description: item.course.name,
        start: [item.startAt.getFullYear(), item.startAt.getMonth() + 1, item.startAt.getDate()],
        end: [nextDay.getFullYear(), nextDay.getMonth() + 1, nextDay.getDate()],
        ...alarms,
      });
    } else {
      events.push({
        uid: uidFor(item.event.id),
        title,
        description: item.course.name,
        start: dateToArray(item.startAt),
        duration: { hours: 1 },
        ...alarms,
      });
    }
  }

  return events;
}

export function generateIcsContent(schedule: Schedule, settings: AppSettings): string {
  const events = scheduleToIcsEvents(schedule, settings);
  const { error, value } = createEvents(events, { calName: "課表掃描" });
  if (error || !value) {
    throw new Error(error?.message ?? "無法產生 .ics 檔案");
  }
  return value;
}
