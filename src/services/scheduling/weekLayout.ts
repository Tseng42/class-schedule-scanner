import { type DayOfWeek } from "../../schema/course";
import type { Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { getHolidayName, getOccurrencesForDate, type CourseOccurrence } from "./nextClass";
import { parseDateKey, toDateKey } from "./dateKey";
import { listEvents } from "./events";

export const DAY_ORDER: DayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export const BLOCK_COLORS = ["bg-lime", "bg-pink", "bg-sky", "bg-mint"];
/** Same palette as BLOCK_COLORS' Tailwind tokens, for contexts (like <canvas>) that can't use CSS classes. */
export const BLOCK_COLOR_HEX = ["#d7f24c", "#ff8fc0", "#7fd6f5", "#b0f5c8"];

export interface LaidOutOccurrence {
  occurrence: CourseOccurrence;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

export interface WeekColumn {
  day: DayOfWeek;
  date: Date;
  isToday: boolean;
  eventCount: number;
  holidayName: string | null;
  items: LaidOutOccurrence[];
}

export interface WeekLayout {
  columns: WeekColumn[];
  startHour: number;
  endHour: number;
  hours: number[];
  colorIndexByCourseId: Map<string, number>;
  rangeLabel: string;
  semesterWeekLabel: string | null;
}

export function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function mondayOf(date: Date): Date {
  return shiftDays(date, -((date.getDay() + 6) % 7));
}

export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function weeksBetween(a: Date, b: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerWeek);
}

/** Splits overlapping courses in the same day into side-by-side lanes so none hide each other. */
export function layoutDay(occurrences: CourseOccurrence[]): LaidOutOccurrence[] {
  const items: LaidOutOccurrence[] = occurrences.map((occurrence) => ({
    occurrence,
    start: toMinutes(occurrence.timeSlot.startTime),
    end: toMinutes(occurrence.timeSlot.endTime),
    lane: 0,
    lanes: 1,
  }));

  let group: LaidOutOccurrence[] = [];
  let groupEnd = -1;

  const flushGroup = () => {
    if (group.length === 0) return;
    const lanes = Math.max(...group.map((item) => item.lane)) + 1;
    for (const item of group) item.lanes = lanes;
  };

  for (const item of items) {
    if (group.length > 0 && item.start >= groupEnd) {
      flushGroup();
      group = [];
      groupEnd = -1;
    }
    const usedLanes = new Set(group.filter((other) => other.end > item.start).map((other) => other.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane++;
    item.lane = lane;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.end);
  }
  flushGroup();

  return items;
}

/** Everything needed to render one week of the timetable — shared by the on-screen grid and the shareable image export. */
export function buildWeekLayout(schedule: Schedule, settings: AppSettings, today: Date, weekOffset: number): WeekLayout {
  const allSlots = schedule.courses.flatMap((course) => course.timeSlots);
  const showWeekend = allSlots.some((slot) => slot.dayOfWeek === "SA" || slot.dayOfWeek === "SU");
  const visibleDays = DAY_ORDER.slice(0, showWeekend ? 7 : 5);

  const startHour = Math.floor(Math.min(...allSlots.map((slot) => toMinutes(slot.startTime))) / 60);
  const endHour = Math.max(
    Math.ceil(Math.max(...allSlots.map((slot) => toMinutes(slot.endTime))) / 60),
    startHour + 4,
  );
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);

  const weekStart = shiftDays(mondayOf(today), weekOffset * 7);
  const todayKey = toDateKey(today);
  const colorIndexByCourseId = new Map(
    schedule.courses.map((course, index) => [course.id, index % BLOCK_COLORS.length]),
  );

  const eventCountByDate = new Map<string, number>();
  for (const item of listEvents(schedule)) {
    eventCountByDate.set(item.event.date, (eventCountByDate.get(item.event.date) ?? 0) + 1);
  }

  const columns: WeekColumn[] = visibleDays.map((day, index) => {
    const date = shiftDays(weekStart, index);
    return {
      day,
      date,
      isToday: toDateKey(date) === todayKey,
      eventCount: eventCountByDate.get(toDateKey(date)) ?? 0,
      holidayName: getHolidayName(schedule, toDateKey(date)),
      items: layoutDay(getOccurrencesForDate(schedule, date, settings, true)),
    };
  });

  const rangeLabel = `${formatMonthDay(columns[0].date)} – ${formatMonthDay(columns[columns.length - 1].date)}`;

  const semesterWeekLabel = (() => {
    if (!settings.semesterStartDate) return null;
    const semesterStartMonday = mondayOf(parseDateKey(settings.semesterStartDate));
    const week = weeksBetween(semesterStartMonday, weekStart) + 1;
    if (week < 1) return null;
    if (settings.semesterEndDate) {
      const semesterEndMonday = mondayOf(parseDateKey(settings.semesterEndDate));
      const totalWeeks = weeksBetween(semesterStartMonday, semesterEndMonday) + 1;
      if (week > totalWeeks) return null;
      return `第 ${week} 週 / 共 ${totalWeeks} 週`;
    }
    return `第 ${week} 週`;
  })();

  return { columns, startHour, endHour, hours, colorIndexByCourseId, rangeLabel, semesterWeekLabel };
}
