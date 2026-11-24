import { tapHaptic } from "../lib/haptics";
import type { AttendanceStatus } from "../schema/schedule";
import { ATTENDANCE_OPTIONS } from "../services/scheduling/attendance";

interface AttendanceButtonsProps {
  /** Read out by screen readers for the whole row, e.g. "微積分 今天 13:10–16:00 出缺席". */
  label: string;
  selected?: AttendanceStatus;
  onSelect: (status: AttendanceStatus) => void;
}

export function AttendanceButtons({ label, selected, onSelect }: AttendanceButtonsProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-5 gap-1.5">
      {ATTENDANCE_OPTIONS.map((option) => {
        const isSelected = option.status === selected;
        return (
          <button
            key={option.status}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              tapHaptic();
              onSelect(option.status);
            }}
            className={`min-h-10 rounded-xl border-2 text-xs font-black transition-transform active:scale-95 ${
              isSelected
                ? "border-ink bg-ink text-lime dark:border-lime dark:bg-lime dark:text-ink"
                : "border-ink/15 bg-white text-ink dark:border-white/15 dark:bg-white/5 dark:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
