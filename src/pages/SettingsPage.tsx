import { useState, type ReactNode } from "react";
import { loadSchedule } from "../services/storage/scheduleRepository";
import { loadSettings, saveSettings } from "../services/storage/settingsRepository";
import { generateIcsContent } from "../services/ics/exportIcs";
import { clearActiveApiKey, hasActiveStoredApiKey, setActiveApiKey } from "../services/ai";

type ReminderUnit = "minutes" | "hours" | "days";

const UNIT_TO_MINUTES: Record<ReminderUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

const UNIT_LABELS: Record<ReminderUnit, string> = {
  minutes: "分鐘前",
  hours: "小時前",
  days: "天前",
};

function deriveUnitAndValue(totalMinutes: number): { unit: ReminderUnit; value: string } {
  if (totalMinutes % 1440 === 0 && totalMinutes >= 1440) {
    return { unit: "days", value: String(totalMinutes / 1440) };
  }
  if (totalMinutes % 60 === 0 && totalMinutes >= 60) {
    return { unit: "hours", value: String(totalMinutes / 60) };
  }
  return { unit: "minutes", value: String(totalMinutes) };
}

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  colorClass: string;
  children: ReactNode;
}

function AccordionSection({ title, subtitle, defaultOpen = false, colorClass, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`rounded-3xl ${colorClass} text-ink`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <h2 className="text-sm font-black">{title}</h2>
        <div className="flex items-center gap-2">
          {subtitle && <span className="text-xs font-bold opacity-60">{subtitle}</span>}
          <span className={`text-base font-black transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </div>
      </button>
      {open && <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>}
    </section>
  );
}

export function SettingsPage() {
  const [schedule] = useState(() => loadSchedule());
  const [settings, setSettings] = useState(() => loadSettings());
  const [savedFlash, setSavedFlash] = useState(false);

  const initialReminder = deriveUnitAndValue(settings.reminderMinutes);
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>(initialReminder.unit);
  const [reminderValueInput, setReminderValueInput] = useState(initialReminder.value);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const [exportError, setExportError] = useState<string | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(() => hasActiveStoredApiKey());
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyFlash, setKeyFlash] = useState<string | null>(null);

  const handleSaveSettings = () => {
    const numeric = Number(reminderValueInput);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setReminderError("請輸入大於 0 的數字");
      return;
    }
    setReminderError(null);
    const reminderMinutes = Math.round(numeric * UNIT_TO_MINUTES[reminderUnit]);
    const updated = { ...settings, reminderMinutes };
    setSettings(updated);
    saveSettings(updated);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleExportIcs = () => {
    try {
      setExportError(null);
      const content = generateIcsContent(schedule, settings);
      const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "課表.ics";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "匯出失敗");
    }
  };

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setActiveApiKey(trimmed);
    setApiKeyInput("");
    setHasKey(true);
    setIsEditingKey(false);
    setKeyFlash("已儲存");
    setTimeout(() => setKeyFlash(null), 2000);
  };

  const handleClearKey = () => {
    clearActiveApiKey();
    setHasKey(false);
    setKeyFlash("已清除,將改用 .env 的設定(如果有的話)");
    setTimeout(() => setKeyFlash(null), 3000);
  };

  const showKeyForm = !hasKey || isEditingKey;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">設定</h1>
      </header>

      <AccordionSection title="提醒 & 學期範圍" colorClass="bg-mint" defaultOpen>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">上課前多久提醒</span>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={reminderValueInput}
              onChange={(event) => setReminderValueInput(event.target.value)}
              className="w-20 rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
            />
            <select
              value={reminderUnit}
              onChange={(event) => setReminderUnit(event.target.value as ReminderUnit)}
              className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
            >
              {(Object.keys(UNIT_LABELS) as ReminderUnit[]).map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </div>
          {reminderError && <span className="text-xs font-bold text-red-700">{reminderError}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">學期開始日(選填)</span>
          <input
            type="date"
            value={settings.semesterStartDate ?? ""}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, semesterStartDate: event.target.value || undefined }))
            }
            onClick={(event) => event.currentTarget.showPicker?.()}
            className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">學期結束日(選填)</span>
          <input
            type="date"
            value={settings.semesterEndDate ?? ""}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, semesterEndDate: event.target.value || undefined }))
            }
            onClick={(event) => event.currentTarget.showPicker?.()}
            className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <p className="text-xs font-bold opacity-70">
          沒有填學期起訖日的話,匯出 .ics 行事曆時會用「今天起算 16 週」當預設範圍。
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveSettings}
            className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95"
          >
            儲存設定
          </button>
          {savedFlash && <span className="text-sm font-black">已儲存</span>}
        </div>
      </AccordionSection>

      <AccordionSection title="匯出到手機行事曆" colorClass="bg-sky">
        <p className="text-xs font-bold opacity-70">
          瀏覽器通知只在這個網頁開著的時候會跳出來,不夠可靠。匯出 .ics 檔匯入 Apple/Google
          行事曆後,由行事曆 App 自己排鬧鐘,就算沒開這個網頁也會準時提醒你。
        </p>
        <button
          type="button"
          onClick={handleExportIcs}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-sky transition-transform active:scale-95"
        >
          匯出 .ics 行事曆檔
        </button>
        {exportError && <p className="text-sm font-bold text-red-700">{exportError}</p>}
      </AccordionSection>

      <AccordionSection title="API Key" colorClass="bg-sky" subtitle={hasKey ? "已設定" : "尚未設定"}>
        {showKeyForm ? (
          <>
            <p className="text-xs font-bold opacity-70">
              Key 只存在你這個瀏覽器的 localStorage,不會上傳到任何伺服器。這裡設定的話會優先於專案的
              .env 設定,適合你以後把這個 app 部署給別人用的情況——每個人用自己的 key,不會共用你的額度。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder="sk-ant-..."
                className="min-w-0 flex-1 rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={!apiKeyInput.trim()}
                className="rounded-full bg-ink px-4 py-2 text-sm font-black text-sky transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                儲存
              </button>
              {hasKey && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingKey(false);
                    setApiKeyInput("");
                  }}
                  className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink"
                >
                  取消
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-sm font-black">
            <span>已設定 API key</span>
            <button
              type="button"
              onClick={() => setIsEditingKey(true)}
              className="underline decoration-2 underline-offset-2"
            >
              更換
            </button>
            <button type="button" onClick={handleClearKey} className="text-ink/60 underline hover:text-ink">
              清除
            </button>
          </div>
        )}
        {keyFlash && <p className="text-sm font-black">{keyFlash}</p>}
      </AccordionSection>
    </main>
  );
}
