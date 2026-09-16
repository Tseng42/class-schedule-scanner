import { useState } from "react";
import { loadSchedule } from "../services/storage/scheduleRepository";
import { loadSettings } from "../services/storage/settingsRepository";
import { useNow } from "../hooks/useNow";
import { useClassReminders } from "../hooks/useClassReminders";
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

  const todayOccurrences = getOccurrencesForDate(schedule, now);
  const current = findCurrentOccurrence(todayOccurrences, now);
  const next = getNextOccurrence(schedule, now);
  const todayLabel = now.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">今天課表</h1>
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
          <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-black text-pink">
            還有 {formatDuration(next.startAt.getTime() - now.getTime())}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-5 text-sm font-bold text-ink/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
          接下來一週沒有課了
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-black tracking-wide text-ink/40 uppercase dark:text-white/40">
          今天的課
        </h2>
        {todayOccurrences.length === 0 ? (
          <p className="rounded-3xl border-2 border-ink/10 bg-white p-4 text-sm font-bold text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
            今天沒有課
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayOccurrences.map((occurrence) => {
              const isPast = occurrence.endAt.getTime() <= now.getTime();
              const isCurrent = current?.timeSlot.id === occurrence.timeSlot.id;
              return (
                <li
                  key={occurrence.timeSlot.id}
                  className={`flex items-center justify-between rounded-2xl p-3.5 ${
                    isCurrent
                      ? "bg-lime text-ink"
                      : isPast
                        ? "bg-transparent text-ink/30 dark:text-white/30"
                        : "border-2 border-ink/10 bg-white text-ink dark:border-white/10 dark:bg-white/5 dark:text-white"
                  }`}
                >
                  <div>
                    <p className="font-black">{occurrence.course.name}</p>
                    {occurrence.course.location && (
                      <p className="text-xs font-bold opacity-60">{occurrence.course.location}</p>
                    )}
                  </div>
                  <span className="text-xs font-black">
                    {occurrence.timeSlot.startTime}–{occurrence.timeSlot.endTime}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
