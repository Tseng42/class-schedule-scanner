import { useState } from "react";
import { DAY_OF_WEEK_LABELS, type DayOfWeek } from "../schema/course";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { getHolidayName, getOccurrencesForDate, type CourseOccurrence } from "../services/scheduling/nextClass";
import { parseDateKey, toDateKey } from "../services/scheduling/dateKey";
import { listEvents } from "../services/scheduling/events";

const DAY_ORDER: DayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const HOUR_HEIGHT = 56;
const GUTTER_WIDTH = 40;
const MIN_COLUMN_WIDTH = 52;
const BLOCK_COLORS = ["bg-lime", "bg-pink", "bg-sky", "bg-mint"];

interface WeeklyTimetableProps {
  schedule: Schedule;
  today: Date;
  settings: AppSettings;
}

interface LaidOutOccurrence {
  occurrence: CourseOccurrence;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function mondayOf(date: Date): Date {
  return shiftDays(date, -((date.getDay() + 6) % 7));
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function weeksBetween(a: Date, b: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerWeek);
}

/** Splits overlapping courses in the same day into side-by-side lanes so none hide each other. */
function layoutDay(occurrences: CourseOccurrence[]): LaidOutOccurrence[] {
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

export function WeeklyTimetable({ schedule, today, settings }: WeeklyTimetableProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const allSlots = schedule.courses.flatMap((course) => course.timeSlots);
  const showWeekend = allSlots.some((slot) => slot.dayOfWeek === "SA" || slot.dayOfWeek === "SU");
  const visibleDays = DAY_ORDER.slice(0, showWeekend ? 7 : 5);

  const startHour = Math.floor(Math.min(...allSlots.map((slot) => toMinutes(slot.startTime))) / 60);
  const endHour = Math.max(
    Math.ceil(Math.max(...allSlots.map((slot) => toMinutes(slot.endTime))) / 60),
    startHour + 4,
  );
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const weekStart = shiftDays(mondayOf(today), weekOffset * 7);
  const todayKey = toDateKey(today);
  const colorIndexByCourseId = new Map(schedule.courses.map((course, index) => [course.id, index % BLOCK_COLORS.length]));

  const eventCountByDate = new Map<string, number>();
  for (const item of listEvents(schedule)) {
    eventCountByDate.set(item.event.date, (eventCountByDate.get(item.event.date) ?? 0) + 1);
  }

  const columns = visibleDays.map((day, index) => {
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

  const gridTemplateColumns = `${GUTTER_WIDTH}px repeat(${columns.length}, minmax(0, 1fr))`;
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

  const navButtonClass =
    "rounded-full border-2 border-ink px-3 py-1.5 text-xs font-black text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white dark:text-white";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setWeekOffset((prev) => prev - 1)} className={navButtonClass}>
          ‹ 上週
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset(0)}
          disabled={weekOffset === 0}
          className={navButtonClass}
        >
          本週
        </button>
        <button type="button" onClick={() => setWeekOffset((prev) => prev + 1)} className={navButtonClass}>
          下週 ›
        </button>
        <span className="ml-auto text-xs font-bold text-ink/50 dark:text-white/50">
          {semesterWeekLabel ? `${semesterWeekLabel} · ${rangeLabel}` : rangeLabel}
        </span>
      </div>

      <div className="overflow-x-auto rounded-3xl border-2 border-ink bg-white dark:border-white/20 dark:bg-white/5">
        <div style={{ minWidth: GUTTER_WIDTH + columns.length * MIN_COLUMN_WIDTH }}>
          <div
            className="grid border-b-2 border-ink/10 dark:border-white/10"
            style={{ gridTemplateColumns }}
          >
            <div />
            {columns.map((column) => (
              <div key={column.day} className="py-2 text-center">
                <p
                  className={`mx-auto w-fit rounded-full px-2 py-0.5 text-xs font-black ${
                    column.isToday ? "bg-ink text-lime dark:bg-lime dark:text-ink" : "text-ink dark:text-white"
                  }`}
                >
                  {DAY_OF_WEEK_LABELS[column.day]}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-ink/40 dark:text-white/40">
                  {formatMonthDay(column.date)}
                </p>
                {column.holidayName && (
                  <p className="mx-auto mt-0.5 w-fit rounded-full bg-mint px-1.5 text-[9px] font-black text-ink">
                    {column.holidayName}
                  </p>
                )}
                {column.eventCount > 0 && (
                  <p className="mx-auto mt-0.5 w-fit rounded-full bg-pink px-1.5 text-[9px] font-black text-ink">
                    {column.eventCount} 事項
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns }}>
            <div className="relative" style={{ height: totalHeight }}>
              {hours.map((hour, index) => (
                <span
                  key={hour}
                  className="absolute right-1 text-[10px] font-bold text-ink/40 dark:text-white/40"
                  style={{ top: index * HOUR_HEIGHT + 2 }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {columns.map((column) => (
              <div
                key={column.day}
                className={`relative border-l border-ink/10 dark:border-white/10 ${
                  column.isToday ? "bg-lime/15 dark:bg-lime/5" : ""
                }`}
                style={{ height: totalHeight }}
              >
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-ink/10 dark:border-white/10"
                    style={{ top: index * HOUR_HEIGHT }}
                  />
                ))}

                {column.items.map((item) => {
                  const { occurrence } = item;
                  const top = ((item.start - startHour * 60) / 60) * HOUR_HEIGHT + 1;
                  const height = Math.max(20, ((item.end - item.start) / 60) * HOUR_HEIGHT - 2);
                  const color = BLOCK_COLORS[colorIndexByCourseId.get(occurrence.course.id) ?? 0];
                  const reason = occurrence.cancelledReason;
                  return (
                    <div
                      key={occurrence.timeSlot.id}
                      className={`absolute overflow-hidden rounded-lg border-2 p-1 text-ink ${
                        reason !== undefined
                          ? "border-dashed border-ink/30 bg-ink/5 dark:border-white/30 dark:bg-white/10 dark:text-white"
                          : `border-ink dark:border-white/30 ${color}`
                      }`}
                      style={{
                        top,
                        height,
                        left: `${(item.lane / item.lanes) * 100}%`,
                        width: `${100 / item.lanes}%`,
                      }}
                    >
                      <p className={`text-[11px] leading-tight font-black ${reason !== undefined ? "line-through opacity-60" : ""}`}>
                        {occurrence.course.name}
                        {occurrence.course.recurrence.type === "once" ? " · 補課" : ""}
                      </p>
                      {reason !== undefined && (
                        <p className="mt-0.5 text-[10px] leading-tight font-black text-pink-dark">
                          {reason === "停課" ? "停課" : `停課 · ${reason}`}
                        </p>
                      )}
                      {reason === undefined && height >= 44 && occurrence.course.location && (
                        <p className="mt-0.5 text-[10px] leading-tight font-bold opacity-70">
                          {occurrence.course.location}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
