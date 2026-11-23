import { useEffect, useRef } from "react";
import type { AttendanceStatus } from "../schema/schedule";
import { ATTENDANCE_LABELS, describeMeeting } from "../services/scheduling/attendance";
import type { CourseOccurrence } from "../services/scheduling/nextClass";
import { AttendanceButtons } from "./AttendanceButtons";

interface AttendanceSheetProps {
  occurrence: CourseOccurrence;
  status?: AttendanceStatus;
  now: Date;
  onSelect: (status: AttendanceStatus) => void;
  onClose: () => void;
}

/** Opened by tapping a class on the timetable, to mark it or change its mark. */
export function AttendanceSheet({ occurrence, status, now, onSelect, onClose }: AttendanceSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // The home screen re-renders every few seconds; keep the latest callback without re-running the open/close effect.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, []);

  const when = describeMeeting(occurrence, now);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-sheet-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border-2 border-ink bg-cream p-5 dark:border-white/20 dark:bg-ink"
      >
        <p id="attendance-sheet-title" className="text-lg font-black text-ink dark:text-white">
          {occurrence.course.name}
        </p>
        <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">
          {when}
          {status ? ` · 目前記為「${ATTENDANCE_LABELS[status]}」` : " · 還沒點名"}
        </p>
        <div className="mt-4">
          <AttendanceButtons label={`${occurrence.course.name} ${when} 出缺席`} selected={status} onSelect={onSelect} />
        </div>
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
