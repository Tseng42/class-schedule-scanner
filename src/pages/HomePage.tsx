import { useState } from "react";
import { loadSchedule } from "../services/storage/scheduleRepository";
import { loadSettings } from "../services/storage/settingsRepository";
import { useNow } from "../hooks/useNow";
import { useClassReminders } from "../hooks/useClassReminders";
import { WeeklyTimetable } from "../components/WeeklyTimetable";
import { WeeklyWorkloadChart } from "../components/WeeklyWorkloadChart";
import { EVENT_KIND_LABELS } from "../schema/course";
import { daysUntil, formatDaysUntil, getUpcomingEvents } from "../services/scheduling/events";
import {
  findCurrentOccurrence,
  formatDuration,
  formatOccurrenceDay,
  getNextOccurrence,
  getOccurrencesForDate,
} from "../services/scheduling/nextClass";

interface HomePageProps {
  onNavigateUpload: () => void;
}

function isNotificationGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function HomePage({ onNavigateUpload }: HomePageProps) {
  const [schedule] = useState(() => loadSchedule());
  const [settings] = useState(() => loadSettings());
  const now = useNow();

  useClassReminders(schedule, settings, isNotificationGranted());

  if (schedule.courses.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <p className="text-2xl font-black text-ink dark:text-white">還沒有課表資料</p>
        <button
          type="button"
          onClick={onNavigateUpload}
          className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
        >
          掃描第一張課表
        </button>
      </main>
    );
  }

  const todayOccurrences = getOccurrencesForDate(schedule, now, settings);
  const current = findCurrentOccurrence(todayOccurrences, now);
  const next = getNextOccurrence(schedule, now, settings);
  const todayLabel = now.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  const upcomingEvents = getUpcomingEvents(schedule, now);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">課表</h1>
        <p className="mt-1 text-sm font-bold text-ink/50 dark:text-white/50">{todayLabel}</p>
      </header>

      {current ? (
        <div className="rounded-3xl bg-lime p-5 text-ink">
          <p className="text-xs font-black tracking-wide uppercase">現在上課中</p>
          <p className="mt-1 text-2xl font-black">{current.course.name}</p>
          <p className="mt-1 text-sm font-bold">
            {current.timeSlot.startTime}–{current.timeSlot.endTime}
            {current.course.location ? ` · ${current.course.location}` : ""}
          </p>
          {current.course.notes && <p className="mt-2 text-sm font-bold">備註:{current.course.notes}</p>}
          <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-black text-lime">
            還有 {formatDuration(current.endAt.getTime() - now.getTime())}下課
          </p>
        </div>
      ) : next ? (
        <div className="rounded-3xl bg-pink p-5 text-ink">
          <p className="text-xs font-black tracking-wide uppercase">
            下一堂課 · {formatOccurrenceDay(next, now)} {next.timeSlot.startTime}
          </p>
          <p className="mt-1 text-2xl font-black">{next.course.name}</p>
          {next.course.location && <p className="mt-1 text-sm font-bold">{next.course.location}</p>}
          {next.course.notes && <p className="mt-2 text-sm font-bold">備註:{next.course.notes}</p>}
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
          <h2 className="px-1 text-xs font-black tracking-wide text-ink/40 uppercase dark:text-white/40">
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
                  <p className="mt-0.5 text-xs font-bold text-ink/50 dark:text-white/50">{item.course.name}</p>
                </div>
                <span className="shrink-0 text-right text-xs font-black text-ink dark:text-white">
                  {formatDaysUntil(daysUntil(item.event, now))}
                  {item.event.time && (
                    <span className="block font-bold text-ink/50 dark:text-white/50">{item.event.time}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeeklyWorkloadChart schedule={schedule} settings={settings} today={now} />

      <WeeklyTimetable schedule={schedule} today={now} settings={settings} />

      <button
        type="button"
        onClick={onNavigateUpload}
        className="self-start rounded-full border-2 border-ink px-5 py-2.5 text-sm font-black text-ink transition-transform active:scale-95 dark:border-white dark:text-white"
      >
        + 掃描新課表
      </button>
    </main>
  );
}
