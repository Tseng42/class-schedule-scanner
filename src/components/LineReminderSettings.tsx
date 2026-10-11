import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { DEFAULT_LINE_DAILY_TIME, type AppSettings } from "../schema/settings";
import { formatDuration } from "../services/scheduling/nextClass";
import { getCurrentUser, onAuthStateChange } from "../services/sync/googleAuth";
import { sendLineTestMessage, type LineTestResult } from "../services/sync/lineReminder";

interface LineReminderSettingsProps {
  settings: AppSettings;
  /** Called with the full updated settings; the parent persists them (which also syncs them to the cloud). */
  onChange: (next: AppSettings) => void;
}

const checkboxClass = "mt-0.5 h-5 w-5 shrink-0 accent-ink";

export function LineReminderSettings({ settings, onChange }: LineReminderSettingsProps) {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LineTestResult | null>(null);

  useEffect(() => onAuthStateChange(setUser), []);

  if (!user) {
    return (
      <p className="text-xs font-bold opacity-70">
        要先在上面的「雲端同步」登入 Google 帳號。LINE 提醒是伺服器讀雲端上的課表來發送的,沒登入就讀不到。
      </p>
    );
  }

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestResult(await sendLineTestMessage());
    setTesting(false);
  };

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        由伺服器在背景傳 LINE 訊息給你,不用開著這個網頁。第一次使用要先照 README 的「LINE 提醒設定」把 LINE
        官方帳號接好。
      </p>

      <label className="flex items-start gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={settings.lineDailySummary === true}
          onChange={(event) => onChange({ ...settings, lineDailySummary: event.target.checked })}
          className={checkboxClass}
        />
        <span>每天早上傳一則今日課表(當天的課、考試作業、備註)</span>
      </label>
      {settings.lineDailySummary === true && (
        <label className="flex flex-wrap items-center gap-2 pl-7 text-sm font-bold">
          傳送時間
          <input
            type="time"
            value={settings.lineDailyTime ?? DEFAULT_LINE_DAILY_TIME}
            onChange={(event) => {
              if (event.target.value) onChange({ ...settings, lineDailyTime: event.target.value });
            }}
            className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
          />
          <span className="text-xs opacity-60">到點後約 5 分鐘內送達</span>
        </label>
      )}

      <label className="flex items-start gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={settings.lineClassReminder === true}
          onChange={(event) => onChange({ ...settings, lineClassReminder: event.target.checked })}
          className={checkboxClass}
        />
        <span>
          每堂課前 {formatDuration(settings.reminderMinutes * 60000)}提醒
          <span className="block text-xs opacity-60">提前多久跟最上面「上課前多久提醒」用同一個設定</span>
        </span>
      </label>

      <p className="text-xs font-bold opacity-70">
        課前提醒靠免費的排程服務每 5 分鐘檢查一次,所以會比設定的時間早到最多 5 分鐘左右。排程服務出狀況時可能漏掉,重要的課建議另外匯出到手機行事曆。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={testing}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? "傳送中…" : "發送測試訊息"}
        </button>
        {testResult && (
          <p className={`text-sm font-bold ${testResult.ok ? "" : "text-red-700"}`}>{testResult.message}</p>
        )}
      </div>
    </>
  );
}
