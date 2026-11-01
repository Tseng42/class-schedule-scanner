import { useState } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { generateIcsContent } from "../services/ics/exportIcs";

interface CalendarExportSettingsProps {
  schedule: Schedule;
  settings: AppSettings;
}

export function CalendarExportSettings({ schedule, settings }: CalendarExportSettingsProps) {
  const [exportError, setExportError] = useState<string | null>(null);

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

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        瀏覽器通知只在這個網頁開著的時候會跳出來,不夠可靠。匯出 .ics 檔匯入 Apple/Google
        行事曆後,由行事曆 App 自己排鬧鐘,就算沒開這個網頁也會準時提醒你。
      </p>
      <button
        type="button"
        onClick={handleExportIcs}
        className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-pink transition-transform active:scale-95"
      >
        匯出 .ics 行事曆檔
      </button>
      {exportError && <p className="text-sm font-bold text-red-700">{exportError}</p>}
    </>
  );
}
