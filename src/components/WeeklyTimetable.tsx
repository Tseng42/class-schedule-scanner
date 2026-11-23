import { useState } from "react";
import { DAY_OF_WEEK_LABELS } from "../schema/course";
import type { AttendanceRecord, AttendanceStatus, Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { buildWeekLayout, formatMonthDay, BLOCK_COLORS } from "../services/scheduling/weekLayout";
import { shareScheduleCard } from "../services/share/scheduleCard";
import {
  ATTENDANCE_BADGES,
  ATTENDANCE_LABELS,
  attendanceKey,
  describeMeeting,
} from "../services/scheduling/attendance";
import type { CourseOccurrence } from "../services/scheduling/nextClass";
import { AttendanceSheet } from "./AttendanceSheet";
import { useBackgroundPhotoUrl } from "../hooks/useBackgroundPhotoUrl";

const HOUR_HEIGHT = 56;
const GUTTER_WIDTH = 40;
const MIN_COLUMN_WIDTH = 52;

interface WeeklyTimetableProps {
  schedule: Schedule;
  today: Date;
  settings: AppSettings;
  attendance?: Record<string, AttendanceRecord>;
  /** When set, classes that have started can be tapped to mark attendance. */
  onMarkAttendance?: (occurrence: CourseOccurrence, status: AttendanceStatus) => void;
}

export function WeeklyTimetable({ schedule, today, settings, attendance, onMarkAttendance }: WeeklyTimetableProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [marking, setMarking] = useState<CourseOccurrence | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const photoUrl = useBackgroundPhotoUrl();
  // Over a photo, faded labels could land on a busy patch, so they go solid.
  const subtleText = photoUrl ? "text-ink dark:text-white" : "text-ink/60 dark:text-white/60";

  const { columns, startHour, hours, colorIndexByCourseId, rangeLabel, semesterWeekLabel } = buildWeekLayout(
    schedule,
    settings,
    today,
    weekOffset,
  );
  const totalHeight = hours.length * HOUR_HEIGHT;
  const nowMinutes = today.getHours() * 60 + today.getMinutes() + today.getSeconds() / 60;
  const nowTop = ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
  const isNowInView = nowTop >= 0 && nowTop <= totalHeight;
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
        <span className="ml-auto text-xs font-bold text-ink/60 dark:text-white/60">
          {semesterWeekLabel ? `${semesterWeekLabel} · ${rangeLabel}` : rangeLabel}
        </span>
      </div>
      {shareError && <p className="text-xs font-bold text-red-700 dark:text-pink">{shareError}</p>}

      <div className="overflow-x-auto rounded-3xl border-2 border-ink bg-white dark:border-white/20 dark:bg-white/5">
        <div className="relative" style={{ minWidth: GUTTER_WIDTH + columns.length * MIN_COLUMN_WIDTH }}>
          {photoUrl && (
            <>
              <img
                src={photoUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute inset-0 size-full object-cover"
              />
              {/* Veil so labels and grid lines read over any photo; deeper in dark mode. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/70 dark:bg-ink/75" />
            </>
          )}
          <div
            className="relative grid border-b-2 border-ink/10 dark:border-white/10"
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
                <p className={`mt-0.5 text-[10px] font-bold ${subtleText}`}>
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

          <div className="relative grid" style={{ gridTemplateColumns }}>
            <div className="relative" style={{ height: totalHeight }}>
              {hours.map((hour, index) => (
                <span
                  key={hour}
                  className={`absolute right-1 text-[10px] font-bold ${subtleText}`}
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
                  const blockClass = `absolute overflow-hidden rounded-lg border-2 p-1 text-ink ${
                    reason !== undefined
                      ? `border-dashed border-ink/30 dark:border-white/30 dark:text-white ${
                          photoUrl ? "bg-white dark:bg-ink" : "bg-ink/5 dark:bg-white/10"
                        }`
                      : `border-ink dark:border-white/30 ${color}`
                  }`;
                  const blockStyle = {
                    top,
                    height,
                    left: `${(item.lane / item.lanes) * 100}%`,
                    width: `${100 / item.lanes}%`,
                  };
                  const canMark = reason === undefined && onMarkAttendance !== undefined && occurrence.startAt <= today;
                  const record = attendance?.[attendanceKey(occurrence)];
                  const isUnmarked = canMark && !record && occurrence.endAt <= today;
                  const content = (
                    <>
                      <p className={`text-[11px] leading-tight font-black ${reason !== undefined ? "line-through opacity-60" : ""}`}>
                        {occurrence.course.name}
                        {occurrence.course.recurrence.type === "once" ? " · 補課" : ""}
                      </p>
                      {reason !== undefined && (
                        <p className="mt-0.5 text-[10px] leading-tight font-black text-red-700 dark:text-pink">
                          {reason === "停課" ? "停課" : `停課 · ${reason}`}
                        </p>
                      )}
                      {reason === undefined && height >= 44 && occurrence.course.location && (
                        <p className="mt-0.5 text-[10px] leading-tight font-bold opacity-70">
                          {occurrence.course.location}
                        </p>
                      )}
                      {canMark && (record || isUnmarked) && (
                        <span
                          aria-hidden="true"
                          className={`absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full text-[9px] leading-none font-black ${
                            record ? "bg-ink text-white" : "border border-ink bg-white text-ink"
                          }`}
                        >
                          {record ? ATTENDANCE_BADGES[record.status] : "?"}
                        </span>
                      )}
                    </>
                  );
                  if (!canMark) {
                    return (
                      <div key={occurrence.timeSlot.id} className={blockClass} style={blockStyle}>
                        {content}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={occurrence.timeSlot.id}
                      type="button"
                      onClick={() => setMarking(occurrence)}
                      aria-label={`${occurrence.course.name} ${describeMeeting(occurrence, today)},${
                        record ? `記為${ATTENDANCE_LABELS[record.status]}` : "還沒點名"
                      },點一下記出缺席`}
                      className={`${blockClass} flex flex-col items-start justify-start text-left transition-transform active:scale-95`}
                      style={blockStyle}
                    >
                      {content}
                    </button>
                  );
                })}

                {column.isToday && isNowInView && (
                  // "Now" marker. In dark mode a lime line would vanish over lime course
                  // blocks, so it gets a thin ink ring there.
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop - 1 }}>
                    <div className="h-0.5 bg-ink dark:bg-lime dark:shadow-[0_0_0_1px_var(--color-ink)]" />
                    <div className="absolute -top-[3px] -left-1 size-2 rounded-full bg-ink dark:bg-lime dark:shadow-[0_0_0_1px_var(--color-ink)]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {marking && onMarkAttendance && (
        <AttendanceSheet
          occurrence={marking}
          status={attendance?.[attendanceKey(marking)]?.status}
          now={today}
          onSelect={(status) => {
            onMarkAttendance(marking, status);
            setMarking(null);
          }}
          onClose={() => setMarking(null)}
        />
      )}
    </section>
  );
}
