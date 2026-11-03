import { useState } from "react";
import { deriveUnitAndValue, UNIT_LABELS, UNIT_TO_MINUTES, type ReminderUnit } from "../lib/settingsStatus";
import type { AppSettings } from "../schema/settings";

interface ReminderTimeSettingsProps {
  settings: AppSettings;
  /** Called with the full updated settings; the parent persists them. */
  onChange: (next: AppSettings) => void;
}

export function ReminderTimeSettings({ settings, onChange }: ReminderTimeSettingsProps) {
  const initial = deriveUnitAndValue(settings.reminderMinutes);
  const [unit, setUnit] = useState<ReminderUnit>(initial.unit);
  const [valueInput, setValueInput] = useState(initial.value);
  const [error, setError] = useState<string | null>(null);

  const applyChange = (nextValue: string, nextUnit: ReminderUnit) => {
    setValueInput(nextValue);
    setUnit(nextUnit);
    const reminderMinutes = Math.round(Number(nextValue) * UNIT_TO_MINUTES[nextUnit]);
    if (!Number.isFinite(reminderMinutes) || reminderMinutes <= 0) {
      setError("請輸入大於 0 的數字");
      return;
    }
    setError(null);
    onChange({ ...settings, reminderMinutes });
  };

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">上課前多久提醒</span>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={valueInput}
            onChange={(event) => applyChange(event.target.value, unit)}
            className="w-20 rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
          />
          <select
            value={unit}
            onChange={(event) => applyChange(valueInput, event.target.value as ReminderUnit)}
            className="rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 font-bold text-ink focus:border-ink focus:outline-none"
          >
            {(Object.keys(UNIT_LABELS) as ReminderUnit[]).map((option) => (
              <option key={option} value={option}>
                {UNIT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        {error && <span className="card-error text-xs font-bold">{error}</span>}
      </label>
      <p className="text-xs font-bold opacity-70">改完會自動儲存。</p>
    </>
  );
}
