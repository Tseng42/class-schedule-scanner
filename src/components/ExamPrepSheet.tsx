import { useEffect, useRef, useState } from "react";
import type { Course, CourseEvent, PrepItem } from "../schema/course";
import { generateId } from "../lib/id";
import { formatExamCountdown, prepProgress } from "../services/scheduling/events";

/** Practice testing is one of the two study methods rated most effective (Dunlosky et al., 2013). */
const PRACTICE_ITEM = "做考古題/練習題";

interface ExamPrepSheetProps {
  course: Course;
  exam: CourseEvent;
  now: Date;
  onChange: (checklist: PrepItem[]) => void;
  onClose: () => void;
}

/** An exam's 複習清單: things to go over before it, ticked off one by one. */
export function ExamPrepSheet({ course, exam, now, onChange, onClose }: ExamPrepSheetProps) {
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const items = exam.checklist ?? [];
  const { done, total } = prepProgress(exam);
  const hasPractice = items.some((item) => item.text === PRACTICE_ITEM);
  const [, month, day] = exam.date.split("-").map(Number);

  const addItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...items, { id: generateId(), text: trimmed }]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-prep-title"
        tabIndex={-1}
        data-swipe-ignore
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-y-auto rounded-3xl border-2 border-ink bg-cream p-5 outline-none dark:border-white/20 dark:bg-ink"
      >
        <p id="exam-prep-title" className="text-lg font-black text-ink dark:text-white">
          {exam.title} · {course.name}
        </p>
        <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">
          {month}/{day}
          {exam.time ? ` ${exam.time}` : ""} · {formatExamCountdown(exam, now)}
        </p>

        <div className="mt-4 flex items-center justify-between text-sm font-black text-ink dark:text-white">
          <span>複習清單</span>
          {total > 0 && (
            <span className="tabular-nums">
              {done}/{total}
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300 dark:bg-lime"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        )}

        {items.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-2xl bg-white py-1.5 pr-1.5 pl-1.5 text-sm font-bold text-ink dark:bg-white/10 dark:text-white"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={Boolean(item.done)}
                  aria-label={`${item.text}複習完了`}
                  onClick={() =>
                    onChange(items.map((other) => (other.id === item.id ? { ...other, done: !item.done || undefined } : other)))
                  }
                  className={`grid size-8 shrink-0 place-items-center rounded-lg border-2 text-sm font-black ${
                    item.done
                      ? "border-ink bg-ink text-lime dark:border-lime dark:bg-lime dark:text-ink"
                      : "border-ink bg-white text-transparent dark:border-white dark:bg-transparent"
                  }`}
                >
                  ✓
                </button>
                <span className={`min-w-0 flex-1 ${item.done ? "line-through opacity-60" : ""}`}>{item.text}</span>
                <button
                  type="button"
                  aria-label={`刪除「${item.text}」`}
                  onClick={() => {
                    onChange(items.filter((other) => other.id !== item.id));
                    // The button is about to unmount; keep focus in the sheet without popping up a phone keyboard.
                    panelRef.current?.focus();
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-base font-black text-ink/50 hover:text-ink dark:text-white/50 dark:hover:text-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-bold text-ink/60 dark:text-white/60">
            把要複習的範圍一項一項加進來,複習完就勾掉。
          </p>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addItem(draft);
            setDraft("");
            inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例如 第 3–5 章"
            aria-label="新增複習項目"
            className="min-w-0 flex-1 rounded-xl border-2 border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full bg-ink px-4 py-2 text-sm font-black text-lime transition-transform active:scale-95 disabled:opacity-40 dark:bg-lime dark:text-ink"
          >
            新增
          </button>
        </form>

        {!hasPractice && (
          <button
            type="button"
            onClick={() => {
              addItem(PRACTICE_ITEM);
              panelRef.current?.focus();
            }}
            className="mt-2 w-fit rounded-full border-2 border-ink/20 px-3 py-1.5 text-xs font-black text-ink dark:border-white/30 dark:text-white"
          >
            + {PRACTICE_ITEM}
          </button>
        )}
        <p className="mt-3 text-xs font-bold text-ink/60 dark:text-white/60">
          研究發現,自己做題目測驗、把複習分散到好幾天,比考前重讀和畫重點更有效。
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
