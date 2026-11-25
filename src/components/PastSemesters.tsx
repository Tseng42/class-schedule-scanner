import { useMemo, useState } from "react";
import { parseCredits } from "../schema/mapExtraction";
import { courseScore } from "../services/grades/grades";
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
  /** Fills in one course's credits or 學期總成績, the only things a past semester lets you change. */
  onSetFields: (semesterId: string, courseId: string, patch: { credits?: number; finalScore?: number }) => void;
}

/** One number on a past course, saved when the field is left. */
function PastField({
  value,
  parse,
  placeholder,
  label,
  onSave,
}: {
  value: number | undefined;
  parse: (text: string) => number | undefined;
  placeholder: string;
  label: string;
  onSave: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [invalid, setInvalid] = useState(false);
  const save = () => {
    if (text.trim() === "") {
      setInvalid(false);
      if (value !== undefined) onSave(undefined);
      return;
    }
    const parsed = parse(text);
    setInvalid(parsed === undefined);
    if (parsed !== undefined && parsed !== value) onSave(parsed);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid}
      className={`w-16 shrink-0 rounded-xl border-2 bg-white px-2 py-1 text-sm font-black text-ink focus:outline-none ${
        invalid ? "border-pink-dark" : "border-ink/20 focus:border-ink"
      }`}
    />
  );
}

function parseScore(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value <= 100 ? value : undefined;
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

export function PastSemesters({ schedule, settings, onSetFields }: PastSemestersProps) {
  const [openReview, setOpenReview] = useState<SemesterReview | null>(null);
  const [creditsOpenId, setCreditsOpenId] = useState<string | null>(null);

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
      <p className="text-xs font-bold opacity-70">
        換學期時收起來的學期,可以看學期回顧和分享圖。除了補填學分和學期總成績,其他都只能看、不能改。
      </p>
      <ul className="flex flex-col gap-2">
        {items.map(({ past, review }) => {
          const hasReview = review !== null && review.classCount > 0;
          const credits = past.courses.reduce((total, course) => total + (course.credits ?? 0), 0);
          const unfilled = past.courses.filter((course) => course.credits === undefined).length;
          const creditsOpen = creditsOpenId === past.id;
          return (
            <li key={past.id} className="rounded-2xl bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-black">{rangeLabel(past, review)}</span>
                  <span className="text-xs font-bold opacity-60">
                    {past.courses.length} 門課 · {credits} 學分{unfilled > 0 ? `(${unfilled} 門沒填)` : ""}
                  </span>
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
              </div>
              {past.courses.length > 0 && (
                <button
                  type="button"
                  aria-expanded={creditsOpen}
                  onClick={() => setCreditsOpenId(creditsOpen ? null : past.id)}
                  className="-mx-1 mt-1 rounded-full px-1 py-1 text-xs font-black underline decoration-2 underline-offset-2"
                >
                  {creditsOpen ? "收起" : "補填學分和成績"}
                </button>
              )}
              {creditsOpen && (
                <ul className="mt-2 flex flex-col gap-1.5 border-t-2 border-ink/10 pt-2">
                  <li className="flex justify-end gap-1.5 text-[10px] font-black opacity-50">
                    <span className="w-16">學分</span>
                    <span className="w-16">總成績</span>
                  </li>
                  {past.courses.map((course) => (
                    <li key={course.id} className="flex items-center justify-between gap-3 text-sm font-black">
                      <span className="min-w-0 truncate">{course.name}</span>
                      <span className="flex shrink-0 gap-1.5">
                        <PastField
                          value={course.credits}
                          parse={parseCredits}
                          placeholder="學分"
                          label={`${course.name} 的學分`}
                          onSave={(credits) => onSetFields(past.id, course.id, { credits })}
                        />
                        <PastField
                          value={course.finalScore}
                          parse={parseScore}
                          placeholder={String(courseScore(course) ?? "成績")}
                          label={`${course.name} 的學期總成績`}
                          onSave={(finalScore) => onSetFields(past.id, course.id, { finalScore })}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
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
