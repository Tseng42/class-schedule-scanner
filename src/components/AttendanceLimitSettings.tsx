import type { AppSettings } from "../schema/settings";
import { ATTENDANCE_LIMIT_LABELS } from "../lib/settingsStatus";

type AttendanceLimit = NonNullable<AppSettings["attendanceLimit"]>;

const OPTIONS: { value: AttendanceLimit; hint: string }[] = [
  { value: "third", hint: "最多學校的規定:缺課達這門課總節數的三分之一,不能考期末考" },
  { value: "half", hint: "比較寬鬆的學校" },
  { value: "none", hint: "只記缺了幾節,不算扣考線" },
];

interface AttendanceLimitSettingsProps {
  settings: AppSettings;
  /** Called with the full updated settings; the parent persists them. */
  onChange: (next: AppSettings) => void;
}

export function AttendanceLimitSettings({ settings, onChange }: AttendanceLimitSettingsProps) {
  const current = settings.attendanceLimit ?? "third";
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">缺課達多少會扣考</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-white px-4 py-3 ${
              current === option.value ? "border-ink" : "border-ink/15"
            }`}
          >
            <input
              type="radio"
              name="attendance-limit"
              value={option.value}
              checked={current === option.value}
              onChange={() => onChange({ ...settings, attendanceLimit: option.value })}
              className="mt-1 accent-ink"
            />
            <span>
              <span className="block text-sm font-black">{ATTENDANCE_LIMIT_LABELS[option.value]}</span>
              <span className="mt-0.5 block text-xs font-bold opacity-70">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs font-bold opacity-70">
        請假和沒去算缺課,公假不算,遲到只記錄。各校規定不同,請以你學校的學則為準。改完會自動儲存。
      </p>
    </>
  );
}
