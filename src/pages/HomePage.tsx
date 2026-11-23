import { useEffect, useState } from "react";
import { loadSchedule } from "../services/storage/scheduleRepository";
import { loadSettings } from "../services/storage/settingsRepository";
import { useNow } from "../hooks/useNow";
import { useClassReminders } from "../hooks/useClassReminders";
import { ClassProgressRing } from "../components/ClassProgressRing";
import { WeeklyTimetable } from "../components/WeeklyTimetable";
import { burstConfetti } from "../lib/confetti";
import { formatDateRange } from "../lib/formatDate";
import { EVENT_KIND_LABELS, type Course } from "../schema/course";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { daysUntil, formatDaysUntil, getUpcomingEvents } from "../services/scheduling/events";
import { toDateKey } from "../services/scheduling/dateKey";
import {
  findCurrentOccurrence,
  formatCountdown,
  formatDuration,
  formatOccurrenceDay,
  getNextOccurrence,
  getOccurrencesForDate,
  type CourseOccurrence,
} from "../services/scheduling/nextClass";
import { getHolidayCountdown, getSemesterStatus } from "../services/scheduling/semester";

/** The last stretch of a class, when the countdown ticks every second. */
const FINAL_COUNTDOWN_MS = 5 * 60 * 1000;
/** How long "下課啦！" stays up after a class ends. */
const CLASS_END_CELEBRATION_MS = 60 * 1000;

/** Classes whose end has already been celebrated, so returning to this page doesn't fire the confetti again. */
const celebratedClasses = new Set<string>();

function occurrenceKey(occurrence: CourseOccurrence): string {
  return `${occurrence.dateKey}|${occurrence.course.id}|${occurrence.timeSlot.id}`;
}

/** The latest class that ended less than CLASS_END_CELEBRATION_MS ago. */
function findJustEnded(occurrences: CourseOccurrence[], now: Date): CourseOccurrence | undefined {
  return [...occurrences]
    .reverse()
    .find((occurrence) => now >= occurrence.endAt && now.getTime() - occurrence.endAt.getTime() < CLASS_END_CELEBRATION_MS);
}

/** When the home screen next needs to redraw: a class starting or ending, or the next second of a countdown. */
function nextScreenChange(schedule: Schedule, settings: AppSettings, at: Date): Date | null {
  const occurrences = getOccurrencesForDate(schedule, at, settings);
  const running = findCurrentOccurrence(occurrences, at);
  if (running) {
    const msLeft = running.endAt.getTime() - at.getTime();
    if (msLeft > FINAL_COUNTDOWN_MS) return new Date(running.endAt.getTime() - FINAL_COUNTDOWN_MS);
    return new Date(at.getTime() + (msLeft % 1000 || 1000));
  }
  const candidates: number[] = [];
  const ended = findJustEnded(occurrences, at);
  if (ended) candidates.push(ended.endAt.getTime() + CLASS_END_CELEBRATION_MS);
  const upcoming = getNextOccurrence(schedule, at, settings);
  if (upcoming) candidates.push(upcoming.startAt.getTime());
  return candidates.length > 0 ? new Date(Math.min(...candidates)) : null;
}

interface HomePageProps {
  onNavigateUpload: () => void;
  onAddCourse: () => void;
}

/** Undated notes are general reminders (always shown); dated ones only surface on their matching class day. */
function relevantNotes(course: Course, at: Date): string[] {
  const dateKey = toDateKey(at);
  return (course.notes ?? [])
    .filter((note) => !note.date || note.date === dateKey)
    .map((note) => note.text);
}

function isNotificationGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function HomePage({ onNavigateUpload, onAddCourse }: HomePageProps) {
  const [schedule] = useState(() => loadSchedule());
  const [settings] = useState(() => loadSettings());
  const now = useNow((at) => nextScreenChange(schedule, settings, at));

  useClassReminders(schedule, settings, isNotificationGranted());

  const todayOccurrences = getOccurrencesForDate(schedule, now, settings);
  const current = findCurrentOccurrence(todayOccurrences, now);
  const justEnded = current ? undefined : findJustEnded(todayOccurrences, now);
  const justEndedKey = justEnded ? occurrenceKey(justEnded) : null;

  useEffect(() => {
    if (!justEndedKey || celebratedClasses.has(justEndedKey)) return;
    celebratedClasses.add(justEndedKey);
    burstConfetti();
  }, [justEndedKey]);

  if (schedule.courses.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <p className="text-2xl font-black text-ink dark:text-white">還沒有課表資料</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onAddCourse}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            + 新增課程
          </button>
          <button
            type="button"
            onClick={onNavigateUpload}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            掃描第一張課表
          </button>
        </div>
      </main>
    );
  }

  const next = getNextOccurrence(schedule, now, settings);
  const todayLabel = now.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  const upcomingEvents = getUpcomingEvents(schedule, now);
  const semester = getSemesterStatus(settings, now);
  const holiday = getHolidayCountdown(schedule, now);
  const msUntilEnd = current ? current.endAt.getTime() - now.getTime() : 0;

  const stripCardClass =
    "min-w-0 flex-1 rounded-2xl border-2 border-ink/10 bg-white p-3.5 text-ink dark:border-white/10 dark:bg-white/5 dark:text-white";
  const stripLabelClass = "text-xs font-black text-ink/60 dark:text-white/60";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">課表</h1>
        <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">{todayLabel}</p>
      </header>

      {(semester || holiday) && (
        <div className="flex gap-3">
          {semester?.kind === "before" && (
            <div className={stripCardClass}>
              <p className={stripLabelClass}>開學倒數</p>
              <p className="mt-1 text-lg font-black">
                {semester.daysUntilStart === 1 ? "明天開學" : `還有 ${semester.daysUntilStart} 天`}
              </p>
            </div>
          )}
          {semester?.kind === "during" && (
            <div className={stripCardClass}>
              <p className={stripLabelClass}>學期進度</p>
              <p className="mt-1 text-lg font-black">
                第 {semester.week} 週
                {semester.totalWeeks !== null && (
                  <span className="text-xs font-bold text-ink/60 dark:text-white/60"> / 共 {semester.totalWeeks} 週</span>
                )}
              </p>
              {semester.fraction !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15">
                  <div
                    className="h-full rounded-full bg-ink dark:bg-lime"
                    style={{ width: `${Math.round(semester.fraction * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {holiday && (
            <div className={stripCardClass}>
              <p className={stripLabelClass}>{holiday.kind === "ongoing" ? "放假中" : "下次放假"}</p>
              <p className="mt-1 truncate text-lg font-black">
                {holiday.kind === "ongoing"
                  ? holiday.name
                  : holiday.days === 1
                    ? "明天"
                    : `還有 ${holiday.days} 天`}
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-ink/60 dark:text-white/60">
                {holiday.kind === "ongoing"
                  ? `放到 ${formatDateRange(holiday.endDate, holiday.endDate)}`
                  : `${holiday.name} · ${formatDateRange(holiday.startDate, holiday.endDate)}`}
              </p>
            </div>
          )}
        </div>
      )}

      {current ? (
        <div className="flex items-start justify-between gap-4 rounded-3xl bg-lime p-5 text-ink">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-wide uppercase">現在上課中</p>
            <p className="mt-1 text-2xl font-black">{current.course.name}</p>
            <p className="mt-1 text-sm font-bold">
              {current.timeSlot.startTime}–{current.timeSlot.endTime}
              {current.course.location ? ` · ${current.course.location}` : ""}
            </p>
            {relevantNotes(current.course, current.startAt).map((text, index) => (
              <p key={index} className="mt-2 text-sm font-bold">
                備註:{text}
              </p>
            ))}
            <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-black text-lime tabular-nums">
              還有 {msUntilEnd <= FINAL_COUNTDOWN_MS ? `${formatCountdown(msUntilEnd)} ` : formatDuration(msUntilEnd)}下課
            </p>
          </div>
          <ClassProgressRing
            startAt={current.startAt}
            endAt={current.endAt}
            now={now}
            finalCountdownMs={FINAL_COUNTDOWN_MS}
          />
        </div>
      ) : justEnded ? (
        <div className="class-end-pop rounded-3xl bg-lime p-5 text-ink">
          <p className="text-xs font-black tracking-wide">{justEnded.course.name} 結束了</p>
          <p className="mt-1 text-3xl font-black">下課啦！</p>
          {next && (
            <p className="mt-3 text-sm font-bold">
              下一堂 · {formatOccurrenceDay(next, now)} {next.timeSlot.startTime} {next.course.name}
            </p>
          )}
        </div>
      ) : next ? (
        <div className="rounded-3xl bg-pink p-5 text-ink">
          <p className="text-xs font-black tracking-wide uppercase">
            下一堂課 · {formatOccurrenceDay(next, now)} {next.timeSlot.startTime}
          </p>
          <p className="mt-1 text-2xl font-black">{next.course.name}</p>
          {next.course.location && <p className="mt-1 text-sm font-bold">{next.course.location}</p>}
          {relevantNotes(next.course, next.startAt).map((text, index) => (
            <p key={index} className="mt-2 text-sm font-bold">
              備註:{text}
            </p>
          ))}
          <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-black text-pink">
            還有 {formatDuration(next.startAt.getTime() - now.getTime())}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-5 text-sm font-bold text-ink/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
          接下來一週沒有課了
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-black tracking-wide text-ink/60 uppercase dark:text-white/60">
            近期事項
          </h2>
          <ul className="flex flex-col gap-2">
            {upcomingEvents.map((item) => (
              <li
                key={item.event.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3.5 dark:border-white/10 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="font-black text-ink dark:text-white">
                    <span className="mr-2 rounded-full bg-sky px-2 py-0.5 text-[10px] text-ink">
                      {EVENT_KIND_LABELS[item.event.kind]}
                    </span>
                    {item.event.title}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-ink/60 dark:text-white/60">{item.course.name}</p>
                </div>
                <span className="shrink-0 text-right text-xs font-black text-ink dark:text-white">
                  {formatDaysUntil(daysUntil(item.event, now))}
                  {item.event.time && (
                    <span className="block font-bold text-ink/60 dark:text-white/60">{item.event.time}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeeklyTimetable schedule={schedule} today={now} settings={settings} />
    </main>
  );
}
