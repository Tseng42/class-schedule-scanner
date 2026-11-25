import { useState } from "react";
import { createPortal } from "react-dom";
import { DAY_OF_WEEK_LABELS, type Course } from "../schema/course";
import { ConfirmDialog } from "./ConfirmDialog";

interface SemesterSwitchProps {
  courses: Course[];
  attendanceCount: number;
  onSwitch: (input: { keepCourseIds: string[]; startDate: string; endDate: string }) => void;
}

const inputClass =
  "rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none";

function describeSlots(course: Course): string {
  return course.timeSlots.map((slot) => `${DAY_OF_WEEK_LABELS[slot.dayOfWeek]} ${slot.startTime}`).join("、");
}

/**
 * 換學期: tick the courses that carry over, enter the new dates, confirm the exact counts.
 * The old semester is put away whole under 過去的學期.
 */
export function SemesterSwitch({ courses, attendanceCount, onSwitch }: SemesterSwitchProps) {
  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState<Set<string>>(() => new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const toggle = (courseId: string) => {
    setKeep((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const handleNext = () => {
    if (!startDate || !endDate) {
      setError("請填新學期的開始日和結束日");
      return;
    }
    if (endDate <= startDate) {
      setError("結束日要晚於開始日");
      return;
    }
    setError(null);
    setConfirming(true);
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-2 border-t-2 border-ink/10 pt-4">
        <p className="text-sm font-black">換學期</p>
        <p className="text-xs font-bold opacity-70">
          新學期開始時用。這學期的課表、點名紀錄會整份收進「過去的學期」,還能看學期回顧;你可以挑幾門課留到下學期。
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-full border-2 border-ink px-4 py-2 text-xs font-black text-ink transition-transform active:scale-95"
        >
          換學期
        </button>
      </div>
    );
  }

  const clearedCount = courses.length - keep.size;
  const keptCount = keep.size;
  const messageParts = [
    clearedCount > 0 ? `會清掉 ${clearedCount} 門課` : null,
    attendanceCount > 0 ? `${attendanceCount} 筆點名紀錄` : null,
  ].filter(Boolean);
  const message = [
    messageParts.length > 0 ? `${messageParts.join("、")}。` : "",
    keptCount > 0 ? `留下 ${keptCount} 門課,只留課名、老師、教室和時間,考試、作業、備註會清掉。` : "",
    "這學期的學期回顧會收進「過去的學期」,之後還能看,但不能還原。",
  ].join("");

  return (
    <div className="flex flex-col gap-3 border-t-2 border-ink/10 pt-4">
      <p className="text-sm font-black">換學期</p>

      {courses.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-black">1. 有哪些課下學期還要上?(沒勾的會清掉)</legend>
          {courses.map((course) => (
            <label
              key={course.id}
              className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-black"
            >
              <input
                type="checkbox"
                checked={keep.has(course.id)}
                onChange={() => toggle(course.id)}
                className="h-5 w-5 shrink-0 accent-ink"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{course.name}</span>
                <span className="truncate text-xs font-bold opacity-60">{describeSlots(course)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-black">{courses.length > 0 ? "2. " : ""}新學期的日期</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setError(null);
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
            aria-label="新學期開始日"
            className={inputClass}
          />
          <span className="text-xs font-black opacity-70">到</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setError(null);
            }}
            onClick={(event) => event.currentTarget.showPicker?.()}
            aria-label="新學期結束日"
            className={inputClass}
          />
        </div>
        <p className="text-xs font-bold opacity-70">每間學校不一樣,請照你學校的校曆填。</p>
      </div>

      {error && <p className="card-error text-xs font-black">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleNext}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-black text-pink transition-transform active:scale-95"
        >
          下一步
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-full px-4 py-2 text-sm font-black text-ink/60"
        >
          取消
        </button>
      </div>

      {/* On the body, so it covers the title bar and tab bar like the other full-screen layers. */}
      {confirming &&
        createPortal(
          <ConfirmDialog
            title="確定要換學期嗎?"
            message={message}
            confirmLabel="換學期"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              onSwitch({ keepCourseIds: [...keep], startDate, endDate });
            }}
          />,
          document.body,
        )}
    </div>
  );
}
