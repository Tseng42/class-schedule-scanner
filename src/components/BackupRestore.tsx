import { useRef, useState } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { createBackup, restoreBackup } from "../services/storage/backup";
import { toDateKey } from "../services/scheduling/dateKey";
import { ConfirmDialog } from "./ConfirmDialog";

interface BackupRestoreProps {
  onRestored: (schedule: Schedule, settings: AppSettings) => void;
}

export function BackupRestore({ onRestored }: BackupRestoreProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoredFlash, setRestoredFlash] = useState(false);

  const handleExport = () => {
    try {
      setError(null);
      const backup = createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `課表備份-${toDateKey(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯出失敗");
    }
  };

  const handleFileSelected = (file: File) => {
    setError(null);
    setPendingFile(file);
  };

  const performRestore = async () => {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const { schedule, settings } = restoreBackup(parsed);
      onRestored(schedule, settings);
      setRestoredFlash(true);
      setTimeout(() => setRestoredFlash(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "還原失敗");
    }
  };

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        備份檔包含所有課程、停課、事項、放假日與設定。清瀏覽器資料或換裝置前,建議先匯出一份存起來。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95"
        >
          匯出完整備份
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full border-2 border-ink px-5 py-2.5 text-sm font-black text-ink transition-transform active:scale-95 dark:border-white dark:text-white"
        >
          匯入備份還原
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFileSelected(file);
            event.target.value = "";
          }}
        />
      </div>
      {restoredFlash && <p className="text-sm font-black">已還原備份</p>}
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}

      {pendingFile && (
        <ConfirmDialog
          title="用這份備份覆蓋現在的資料?"
          message={`「${pendingFile.name}」會取代目前所有課程、事項與設定,這個動作無法復原。`}
          confirmLabel="覆蓋還原"
          onConfirm={() => void performRestore()}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </>
  );
}
