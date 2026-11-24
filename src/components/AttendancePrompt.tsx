import { RollingNumber } from "./RollingNumber";
import { useState } from "react";
import type { AttendanceStatus } from "../schema/schedule";
import { attendanceKey, describeMeeting } from "../services/scheduling/attendance";
import type { CourseOccurrence } from "../services/scheduling/nextClass";
import { AttendanceButtons } from "./AttendanceButtons";

const INITIAL_VISIBLE = 3;
const SHOW_MORE_STEP = 10;

interface AttendancePromptProps {
  /** Ended classes nobody has marked yet, most recent first. */
  unmarked: CourseOccurrence[];
  now: Date;
  onMark: (occurrence: CourseOccurrence, status: AttendanceStatus) => void;
  error: string | null;
}

/** The home screen's "還沒點名" card: every ended class waits here until it's marked. */
export function AttendancePrompt({ unmarked, now, onMark, error }: AttendancePromptProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  if (unmarked.length === 0) return null;

  const shown = unmarked.slice(0, visibleCount);
  const hiddenCount = unmarked.length - shown.length;

  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-black text-ink dark:text-white">還沒點名</h2>
        <span className="text-xs font-bold text-ink/60 dark:text-white/60"><RollingNumber value={`${unmarked.length} 堂`} /></span>
      </div>

      <ul className="mt-3 flex flex-col gap-4">
        {shown.map((occurrence) => {
          const when = describeMeeting(occurrence, now);
          return (
            <li key={attendanceKey(occurrence)}>
              <p className="text-sm font-black text-ink dark:text-white">
                {occurrence.course.name}
                <span className="ml-1.5 text-xs font-bold text-ink/60 dark:text-white/60">{when}</span>
              </p>
              <div className="mt-1.5">
                <AttendanceButtons
                  label={`${occurrence.course.name} ${when} 出缺席`}
                  onSelect={(status) => onMark(occurrence, status)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + SHOW_MORE_STEP)}
          className="mt-4 w-full rounded-full border-2 border-ink/15 py-2 text-xs font-black text-ink transition-transform active:scale-95 dark:border-white/15 dark:text-white"
        >
          <RollingNumber value={`再顯示 ${Math.min(SHOW_MORE_STEP, hiddenCount)} 堂(還有 ${hiddenCount} 堂)`} />
        </button>
      )}

      {error && <p className="card-error mt-3 text-xs font-bold">{error}</p>}
    </section>
  );
}
