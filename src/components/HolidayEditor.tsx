import { useState } from "react";
import type { Holiday } from "../schema/schedule";
import { generateId } from "../lib/id";
import { formatDateRange } from "../lib/formatDate";

interface HolidayEditorProps {
  holidays: Holiday[];
  onAdd: (holiday: Holiday) => void;
  onRemove: (holidayId: string) => void;
  onAddOfficial: () => { addedCount: number; skippedCount: number } | null;
}

const inputClass =
  "rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none";

export function HolidayEditor({ holidays, onAdd, onRemove, onAddOfficial }: HolidayEditorProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [officialFlash, setOfficialFlash] = useState<string | null>(null);

  const sorted = [...holidays].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const handleAddOfficial = () => {
    const result = onAddOfficial();
    if (!result) return;
    setOfficialFlash(
      result.addedCount === 0
        ? "都已經加過了"
        : `已加入 ${result.addedCount} 筆${result.skippedCount > 0 ? `,${result.skippedCount} 筆已經有了` : ""}`,
    );
    setTimeout(() => setOfficialFlash(null), 3000);
  };

  const handleAdd = () => {
    if (!startDate) {
      setError("請選擇日期");
      return;
    }
    const end = endDate || startDate;
    if (end < startDate) {
      setError("結束日期不能早於開始日期");
      return;
    }
    onAdd({ id: generateId(), name: name.trim() || "放假", startDate, endDate: end });
    setName("");
    setStartDate("");
    setEndDate("");
    setError(null);
  };

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        國定假日、校慶這種「全部課程都不用上」的日子,填一次就會套用到所有課程:課表格會變灰,匯出的行事曆也會自動跳過。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAddOfficial}
          className="self-start rounded-full border-2 border-ink px-4 py-2 text-xs font-black text-ink transition-transform active:scale-95"
        >
          一鍵加入台灣 2026 國定假日
        </button>
        {officialFlash && <span className="text-xs font-black">{officialFlash}</span>}
      </div>
      <p className="text-xs font-bold opacity-50">
        資料來自行政院人事行政總處公告的辦公日曆表,不同學校的校曆可能有出入,加入後可以自行刪改。
      </p>

      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {sorted.map((holiday) => (
            <li
              key={holiday.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-white py-1.5 pr-1.5 pl-3 text-xs font-black"
            >
              <span>
                {holiday.name} · {formatDateRange(holiday.startDate, holiday.endDate)}
              </span>
              <button
                type="button"
                aria-label={`刪除 ${holiday.name}`}
                onClick={() => onRemove(holiday.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 hover:bg-ink hover:text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="名稱,例如 國慶日、校慶"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setError(null);
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
            aria-label="放假開始日期"
            className={inputClass}
          />
          <span className="text-xs font-black opacity-50">到</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setError(null);
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
            aria-label="放假結束日期(選填)"
            className={inputClass}
          />
          <span className="text-xs font-bold opacity-50">(只有一天可以不填)</span>
        </div>
        {error && <p className="text-xs font-black text-red-700">{error}</p>}
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-pink transition-transform active:scale-95"
        >
          新增放假日
        </button>
      </div>
    </>
  );
}
