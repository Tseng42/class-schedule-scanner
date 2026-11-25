import { useMemo, useState } from "react";
import type { PastSemester, Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { buildSemesterReview, type SemesterReview } from "../services/scheduling/semesterReview";
import { addDays, parseDateKey, toDateKey } from "../services/scheduling/dateKey";
import { formatDateRange } from "../lib/formatDate";
import { collapseBack, expandFrom } from "../lib/expandTransition";
import { SemesterReviewStory } from "./SemesterReviewStory";

interface PastSemestersProps {
  schedule: Schedule;
  settings: AppSettings;
}

/**
 * The review of a semester put away by 換學期, rebuilt from its snapshot as it stood
 * that day. Focus sessions were never cleared, so they come from the live schedule.
 */
function reviewOf(past: PastSemester, schedule: Schedule, settings: AppSettings): SemesterReview | null {
  const snapshot: Schedule = {
    version: 1,
    courses: past.courses,
    holidays: past.holidays,
    attendance: past.attendance,
    focusSessions: schedule.focusSessions,
  };
  // It ended on its last day, or the day it was put away if that came first. Looked at
  // from the midnight after, so it reads as a finished semester.
  const endKey = archivedEndKey(past);
  const dayAfter = parseDateKey(addDays(endKey, 1));
  return buildSemesterReview(
    snapshot,
    { ...settings, semesterStartDate: past.startDate, semesterEndDate: endKey },
    dayAfter,
  );
}

function archivedEndKey(past: PastSemester): string {
  const archivedKey = toDateKey(new Date(past.archivedAt));
  return past.endDate && past.endDate < archivedKey ? past.endDate : archivedKey;
}

function rangeLabel(past: PastSemester, review: SemesterReview | null): string {
  const start = past.startDate ?? review?.startKey;
  const end = archivedEndKey(past);
  return start ? formatDateRange(start, end) : `收起來於 ${formatDateRange(end, end)}`;
}

export function PastSemesters({ schedule, settings }: PastSemestersProps) {
  const [openReview, setOpenReview] = useState<SemesterReview | null>(null);

  const items = useMemo(
    () =>
      Object.values(schedule.pastSemesters ?? {})
        .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
        .map((past) => ({ past, review: reviewOf(past, schedule, settings) })),
    [schedule, settings],
  );

  if (items.length === 0) {
    return (
      <p className="text-sm font-bold opacity-70">還沒有過去的學期。在「學期範圍」換學期之後,舊學期會收在這裡。</p>
    );
  }

  return (
    <>
      <p className="text-xs font-bold opacity-70">換學期時收起來的學期,只能看、不能改,可以看學期回顧和分享圖。</p>
      <ul className="flex flex-col gap-2">
        {items.map(({ past, review }) => {
          const hasReview = review !== null && review.classCount > 0;
          return (
            <li key={past.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-black">{rangeLabel(past, review)}</span>
                <span className="text-xs font-bold opacity-60">{past.courses.length} 門課</span>
              </span>
              {hasReview ? (
                <button
                  type="button"
                  onClick={(event) => expandFrom(event.currentTarget, () => setOpenReview(review))}
                  className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-black text-pink transition-transform active:scale-95"
                >
                  看學期回顧
                </button>
              ) : (
                <span className="shrink-0 text-xs font-bold opacity-60">沒有上過的課可以回顧</span>
              )}
            </li>
          );
        })}
      </ul>
      {openReview && (
        <SemesterReviewStory review={openReview} onClose={() => collapseBack(() => setOpenReview(null))} />
      )}
    </>
  );
}
