import { useState } from "react";
import { DAY_OF_WEEK_LABELS } from "../schema/course";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { buildWeekLayout, formatMonthDay, BLOCK_COLORS } from "../services/scheduling/weekLayout";
import { shareScheduleCard } from "../services/share/scheduleCard";

const HOUR_HEIGHT = 56;
const GUTTER_WIDTH = 40;
const MIN_COLUMN_WIDTH = 52;

interface WeeklyTimetableProps {
  schedule: Schedule;
  today: Date;
  settings: AppSettings;
}

export function WeeklyTimetable({ schedule, today, settings }: WeeklyTimetableProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const { columns, startHour, hours, colorIndexByCourseId, rangeLabel, semesterWeekLabel } = buildWeekLayout(
    schedule,
    settings,
    today,
    weekOffset,
  );
  const totalHeight = hours.length * HOUR_HEIGHT;
  const gridTemplateColumns = `${GUTTER_WIDTH}px repeat(${columns.length}, minmax(0, 1fr))`;

  const navButtonClass =
    "rounded-full border-2 border-ink px-3 py-1.5 text-xs font-black text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white dark:text-white";

  const handleShare = async () => {
    setIsSharing(true);
    setShareError(null);
    try {
      await shareScheduleCard(schedule, settings, today, weekOffset);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "產生圖片失敗");
    } finally {
      setIsSharing(false);
    }
  };

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
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={isSharing}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-black text-lime transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-lime dark:text-ink"
        >
          {isSharing ? "產生中…" : "分享課表"}
        </button>
        <span className="ml-auto text-xs font-bold text-ink/50 dark:text-white/50">
          {semesterWeekLabel ? `${semesterWeekLabel} · ${rangeLabel}` : rangeLabel}
        </span>
      </div>
      {shareError && <p className="text-xs font-bold text-pink-dark">{shareError}</p>}

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
