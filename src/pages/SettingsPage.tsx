import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { addHoliday, addHolidays, loadSchedule, removeHoliday } from "../services/storage/scheduleRepository";
import { OFFICIAL_HOLIDAYS_TW_2026 } from "../data/officialHolidays";
import { loadSettings, saveSettings } from "../services/storage/settingsRepository";
import { hasActiveStoredApiKey } from "../services/ai";
import { ApiKeySettings } from "../components/ApiKeySettings";
import { BackupRestore } from "../components/BackupRestore";
import { BrowserNotificationSettings } from "../components/BrowserNotificationSettings";
import { CalendarExportSettings } from "../components/CalendarExportSettings";
import { CloudSyncSettings } from "../components/CloudSyncSettings";
import { HolidayEditor } from "../components/HolidayEditor";
import { LineReminderSettings } from "../components/LineReminderSettings";
import { ReminderTimeSettings } from "../components/ReminderTimeSettings";
import { SemesterSettings } from "../components/SemesterSettings";
import { formatReminderLead, formatSemesterRange, notificationStatusLabel } from "../lib/settingsStatus";
import { isSyncConfigured } from "../services/sync/firebaseConfig";
import { getCurrentUser, onAuthStateChange } from "../services/sync/googleAuth";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";

export type SettingsSection =
  | "reminder"
  | "line"
  | "notifications"
  | "semester"
  | "holidays"
  | "calendar"
  | "sync"
  | "backup"
  | "apiKey";

interface SettingsRow {
  section: SettingsSection;
  title: string;
  status?: string;
}

interface SettingsGroup {
  title: string;
  colorClass: string;
  rows: SettingsRow[];
}

interface SettingsPageProps {
  section: SettingsSection | null;
  onOpenSection: (section: SettingsSection) => void;
  onBack: () => void;
}

export function SettingsPage({ section, onOpenSection, onBack }: SettingsPageProps) {
  const [schedule, setSchedule] = useState(() => loadSchedule());
  const [settings, setSettings] = useState(() => loadSettings());
  const [storageError, setStorageError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => getCurrentUser());

  useEffect(() => onAuthStateChange(setUser), []);

  const withStorageErrorHandling = <T,>(action: () => T): T | undefined => {
    try {
      setStorageError(null);
      return action();
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "儲存失敗");
      return undefined;
    }
  };

  const handleSettingsChange = (next: AppSettings) => {
    const saved = withStorageErrorHandling(() => {
      saveSettings(next);
      return next;
    });
    if (saved) setSettings(saved);
  };

  const handleRestored = (restoredSchedule: Schedule, restoredSettings: AppSettings) => {
    setSchedule(restoredSchedule);
    setSettings(restoredSettings);
  };

  const groups: SettingsGroup[] = [
    {
      title: "上課提醒",
      colorClass: "bg-mint",
      rows: [
        { section: "reminder", title: "上課前提醒", status: formatReminderLead(settings.reminderMinutes) },
        ...(isSyncConfigured
          ? [
              {
                section: "line" as const,
                title: "LINE 提醒",
                status: settings.lineDailySummary || settings.lineClassReminder ? "已開啟" : "未開啟",
              },
            ]
          : []),
        { section: "notifications", title: "瀏覽器通知", status: notificationStatusLabel() },
      ],
    },
    {
      title: "學期與行事曆",
      colorClass: "bg-pink",
      rows: [
        { section: "semester", title: "學期範圍", status: formatSemesterRange(settings) },
        {
          section: "holidays",
          title: "全校放假日",
          status: schedule.holidays?.length ? `${schedule.holidays.length} 筆` : "尚未新增",
        },
        { section: "calendar", title: "匯出到手機行事曆" },
      ],
    },
    {
      title: "帳號與資料",
      colorClass: "bg-sky",
      rows: [
        ...(isSyncConfigured
          ? [{ section: "sync" as const, title: "雲端同步", status: user ? "已登入" : "未登入" }]
          : []),
        { section: "backup", title: "備份與還原" },
        { section: "apiKey", title: "API Key", status: hasActiveStoredApiKey() ? "已設定" : "尚未設定" },
      ],
    },
  ];

  const storageErrorBanner = storageError && (
    <div className="rounded-3xl bg-pink p-4 text-sm font-bold text-ink">{storageError}</div>
  );

  const activeGroup = groups.find((group) => group.rows.some((row) => row.section === section));
  const activeRow = activeGroup?.rows.find((row) => row.section === section);

  if (activeGroup && activeRow) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-8">
        <header className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={onBack}
            className="-my-2 -ml-2 rounded-full px-2 py-2 text-sm font-black text-ink dark:text-white"
          >
            ‹ 設定
          </button>
          <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">{activeRow.title}</h1>
        </header>

        {storageErrorBanner}

        <section className={`flex flex-col gap-4 rounded-3xl ${activeGroup.colorClass} p-5 text-ink`}>
          {activeRow.section === "reminder" && (
            <ReminderTimeSettings settings={settings} onChange={handleSettingsChange} />
          )}
          {activeRow.section === "line" && (
            <LineReminderSettings settings={settings} onChange={handleSettingsChange} />
          )}
          {activeRow.section === "notifications" && (
            <BrowserNotificationSettings reminderMinutes={settings.reminderMinutes} />
          )}
          {activeRow.section === "semester" && (
            <SemesterSettings settings={settings} onChange={handleSettingsChange} />
          )}
          {activeRow.section === "holidays" && (
            <HolidayEditor
              holidays={schedule.holidays ?? []}
              onAdd={(holiday) => {
                const updated = withStorageErrorHandling(() => addHoliday(holiday));
                if (updated) setSchedule(updated);
              }}
              onRemove={(holidayId) => {
                const updated = withStorageErrorHandling(() => removeHoliday(holidayId));
                if (updated) setSchedule(updated);
              }}
              onAddOfficial={() => {
                const result = withStorageErrorHandling(() => addHolidays(OFFICIAL_HOLIDAYS_TW_2026));
                if (!result) return null;
                setSchedule(result.schedule);
                return { addedCount: result.addedCount, skippedCount: result.skippedCount };
              }}
            />
          )}
          {activeRow.section === "calendar" && <CalendarExportSettings schedule={schedule} settings={settings} />}
          {activeRow.section === "sync" && <CloudSyncSettings />}
          {activeRow.section === "backup" && <BackupRestore onRestored={handleRestored} />}
          {activeRow.section === "apiKey" && <ApiKeySettings />}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">設定</h1>
      </header>

      {storageErrorBanner}

      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-black text-ink/50 dark:text-white/50">{group.title}</h2>
          <div className={`divide-y divide-ink/10 overflow-hidden rounded-3xl ${group.colorClass} text-ink`}>
            {group.rows.map((row) => (
              <button
                key={row.section}
                type="button"
                onClick={() => onOpenSection(row.section)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left active:bg-ink/10"
              >
                <span className="text-sm font-black">{row.title}</span>
                <span className="flex items-center gap-2">
                  {row.status && <span className="text-xs font-bold opacity-60">{row.status}</span>}
                  <span aria-hidden="true" className="text-base leading-none font-black opacity-40">
                    ›
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
