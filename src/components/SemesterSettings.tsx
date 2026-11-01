import type { AppSettings } from "../schema/settings";

interface SemesterSettingsProps {
  settings: AppSettings;
  /** Called with the full updated settings; the parent persists them. */
  onChange: (next: AppSettings) => void;
}

export function SemesterSettings({ settings, onChange }: SemesterSettingsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">學期開始日(選填)</span>
        <input
          type="date"
          value={settings.semesterStartDate ?? ""}
          onChange={(event) => onChange({ ...settings, semesterStartDate: event.target.value || undefined })}
          onClick={(event) => event.currentTarget.showPicker?.()}
          className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">學期結束日(選填)</span>
        <input
          type="date"
          value={settings.semesterEndDate ?? ""}
          onChange={(event) => onChange({ ...settings, semesterEndDate: event.target.value || undefined })}
          onClick={(event) => event.currentTarget.showPicker?.()}
          className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
        />
      </label>
      <p className="text-xs font-bold opacity-70">
        沒有填學期起訖日的話,匯出 .ics 行事曆時會用「今天起算 16 週」當預設範圍。改完會自動儲存。
      </p>
    </>
  );
}
