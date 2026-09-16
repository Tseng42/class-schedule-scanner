import { useState } from "react";
import { loadSchedule } from "../services/storage/scheduleRepository";
import { loadSettings } from "../services/storage/settingsRepository";
import { useNow } from "../hooks/useNow";
import { useClassReminders } from "../hooks/useClassReminders";
import { AccordionSection } from "../components/AccordionSection";
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

type NotificationState = "unsupported" | NotificationPermission;

function isStandaloneDisplayMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function HomePage({ onNavigateUpload }: HomePageProps) {
  const [schedule] = useState(() => loadSchedule());
  const [settings] = useState(() => loadSettings());
  const now = useNow();
  const [notificationState, setNotificationState] = useState<NotificationState>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [standalone] = useState(() => isStandaloneDisplayMode());
  const [ios] = useState(() => isIos());

  useClassReminders(schedule, settings, notificationState === "granted");

  const handleEnableNotifications = async () => {
    setNotificationError(null);
    if (typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      if (permission !== "granted") {
        setNotificationError(
          ios && !standalone
            ? "沒有跳出授權視窗——iPhone 上一定要先「加入主畫面」變成獨立 App,在 Safari 分頁裡是不會跳的"
            : "你剛剛沒有允許通知",
        );
      }
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "請求通知權限時發生錯誤");
    }
  };

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
  const notificationSubtitle =
    notificationState === "unsupported"
      ? "不支援"
      : notificationState === "granted"
        ? "已開啟"
        : notificationState === "denied"
          ? "已封鎖"
          : "尚未開啟";

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

      <AccordionSection title="瀏覽器通知(方便功能)" colorClass="bg-mint" subtitle={notificationSubtitle}>
        <p className="text-xs font-bold opacity-70">
          只在這個網頁開著的時候才會準時跳出來,分頁關掉或瀏覽器背景太久都可能失效,不是可靠的提醒方式。
        </p>
        {ios && (
          <p className="text-xs font-black opacity-60">
            目前開啟方式:{standalone ? "獨立 App(已加到主畫面)" : "Safari 分頁——iPhone 通知必須先加到主畫面才能用"}
          </p>
        )}
        {notificationState === "unsupported" ? (
          <p className="text-sm font-bold opacity-70">這個瀏覽器不支援通知功能</p>
        ) : notificationState === "granted" ? (
          <p className="text-sm font-black">已開啟,上課前 {formatDuration(settings.reminderMinutes * 60000)}會提醒你</p>
        ) : notificationState === "denied" ? (
          <p className="text-sm font-bold opacity-70">已被封鎖,如果想開啟,請到瀏覽器的網站設定裡手動允許通知</p>
        ) : (
          <button
            type="button"
            onClick={() => void handleEnableNotifications()}
            className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95"
          >
            開啟瀏覽器提醒
          </button>
        )}
        {notificationError && <p className="text-sm font-bold text-red-700">{notificationError}</p>}
      </AccordionSection>

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
