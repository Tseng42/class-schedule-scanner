import { useEffect, useRef, useState } from "react";
import type { Course } from "../schema/course";
import {
  LENGTH_LIMITS,
  ROUNDS_PER_LONG_BREAK,
  validateLengths,
  type FocusLengths,
} from "../services/focus/focusTimer";

interface FocusSetupSheetProps {
  courses: Course[];
  lengths: FocusLengths;
  onStart: (lengths: FocusLengths, courseId: string | undefined) => void;
  onClose: () => void;
}

const FIELDS: { key: keyof FocusLengths; label: string }[] = [
  { key: "focusMinutes", label: "專注" },
  { key: "breakMinutes", label: "休息" },
  { key: "longBreakMinutes", label: `每 ${ROUNDS_PER_LONG_BREAK} 輪長休息` },
];

function toMinutes(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

function isOutOfRange(key: keyof FocusLengths, value: number | null): boolean {
  const { min, max } = LENGTH_LIMITS[key];
  return value === null || value < min || value > max;
}

/** Picks the course and the minutes before a 專注計時 run starts. */
export function FocusSetupSheet({ courses, lengths, onStart, onClose }: FocusSetupSheetProps) {
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<Record<keyof FocusLengths, string>>({
    focusMinutes: String(lengths.focusMinutes),
    breakMinutes: String(lengths.breakMinutes),
    longBreakMinutes: String(lengths.longBreakMinutes),
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, []);

  const parsed = {
    focusMinutes: toMinutes(draft.focusMinutes),
    breakMinutes: toMinutes(draft.breakMinutes),
    longBreakMinutes: toMinutes(draft.longBreakMinutes),
  };
  const error = validateLengths(parsed);

  const chipClass = (selected: boolean) =>
    `rounded-full border-2 px-3 py-1.5 text-sm font-black transition-colors ${
      selected
        ? "border-ink bg-ink text-lime dark:border-lime dark:bg-lime dark:text-ink"
        : "border-ink/15 bg-white text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-setup-title"
        tabIndex={-1}
        data-swipe-ignore
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-y-auto rounded-3xl border-2 border-ink bg-cream p-5 outline-none dark:border-white/20 dark:bg-ink"
      >
        <p id="focus-setup-title" className="text-lg font-black text-ink dark:text-white">
          專注模式
        </p>

        <p id="focus-course-label" className="mt-4 text-sm font-black text-ink dark:text-white">
          要讀哪一門?
        </p>
        <div role="radiogroup" aria-labelledby="focus-course-label" className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={courseId === undefined}
            onClick={() => setCourseId(undefined)}
            className={chipClass(courseId === undefined)}
          >
            不指定
          </button>
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              role="radio"
              aria-checked={courseId === course.id}
              onClick={() => setCourseId(course.id)}
              className={chipClass(courseId === course.id)}
            >
              {course.name}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {FIELDS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-xs font-black text-ink dark:text-white">
              <span className="min-h-[2lh] content-end">{label}</span>
              <span className="flex items-baseline gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`${label}(分鐘)`}
                  value={draft[key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  aria-describedby={error ? "focus-length-error" : undefined}
                  aria-invalid={isOutOfRange(key, parsed[key])}
                  className="w-full min-w-0 rounded-xl border-2 border-ink/15 bg-white px-3 py-2 text-base font-black text-ink tabular-nums focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
                />
                <span className="shrink-0 font-bold text-ink/60 dark:text-white/60">分</span>
              </span>
            </label>
          ))}
        </div>
        {error && (
          <p id="focus-length-error" className="mt-2 text-xs font-bold text-red-700 dark:text-pink">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs font-bold text-ink/60 dark:text-white/60">
          不想照節奏走也沒關係,隨時可以提早結束,專注過的時間照樣記下來。
        </p>

        <button
          type="button"
          disabled={error !== null}
          onClick={() => onStart(parsed as FocusLengths, courseId)}
          className="mt-5 rounded-full bg-ink px-5 py-3 text-base font-black text-lime transition-transform active:scale-95 disabled:opacity-40 dark:bg-lime dark:text-ink"
        >
          開始
        </button>
        <p className="mt-3 text-xs font-bold text-ink/60 dark:text-white/60">
          iPhone 鎖螢幕或切到別的 App 時,時間到不一定會響;回到這裡時間會是對的。計時中會盡量讓螢幕保持亮著。
        </p>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
