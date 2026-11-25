import { DAY_OF_WEEK_LABELS } from "../schema/course";
import { formatDateRange } from "../lib/formatDate";
import { levelLabel } from "../services/achievements/achievements";
import { formatFocusTime } from "../services/focus/focusTimer";
import { dayOfWeekOf } from "../services/scheduling/dateKey";
import type { WeeklyReview } from "../services/scheduling/weeklyReview";

interface WeeklyReviewCardProps {
  review: WeeklyReview;
  onDismiss: () => void;
}

const tileClass = "rounded-2xl bg-white/70 px-3 py-2 dark:bg-white/10";
const labelClass = "text-[11px] font-black text-ink/60 dark:text-white/60";
const valueClass = "text-lg leading-tight font-black tabular-nums";
const subClass = "mt-0.5 text-[11px] font-bold text-ink/70 dark:text-white/70";

function hours(minutes: number): string {
  const value = Math.round((minutes / 60) * 10) / 10;
  return `${value} 小時`;
}

/** "↑ 30 分鐘" against the week before, or nothing when there's nothing to compare. */
function FocusChange({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return null;
  const diff = now - before;
  if (diff === 0) return <p className={subClass}>跟前一週一樣</p>;
  return (
    <p className={subClass}>
      比前一週{diff > 0 ? "多" : "少"} {formatFocusTime(Math.abs(diff))} {diff > 0 ? "↑" : "↓"}
    </p>
  );
}

/** 每週小回顧 on the home screen: last week's numbers and what this week holds. */
export function WeeklyReviewCard({ review, onDismiss }: WeeklyReviewCardProps) {
  const { attendance } = review;
  const marked = attendance.present + attendance.late + attendance.leave + attendance.official + attendance.absent;
  const attended = attendance.present + attendance.late + attendance.official;
  const assignments = review.assignmentsDone + review.assignmentsOpen;
  const otherMarks = [
    attendance.late > 0 ? `遲到 ${attendance.late}` : null,
    attendance.leave > 0 ? `請假 ${attendance.leave}` : null,
    attendance.official > 0 ? `公假 ${attendance.official}` : null,
    attendance.absent > 0 ? `沒去 ${attendance.absent}` : null,
    review.unmarked > 0 ? `沒點名 ${review.unmarked}` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-3xl bg-lime/60 p-4 text-ink dark:bg-lime/15 dark:text-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black">上週小回顧</h2>
          <p className="text-xs font-bold text-ink/60 dark:text-white/60">
            {formatDateRange(review.weekKey, review.endKey)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="收起上週小回顧"
          className="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full text-xl leading-none font-black"
        >
          ×
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {review.classCount > 0 && (
          <div className={tileClass}>
            <p className={labelClass}>上課</p>
            <p className={valueClass}>{review.classCount} 堂</p>
            <p className={subClass}>共 {hours(review.classMinutes)}</p>
          </div>
        )}
        {review.classCount > 0 && (
          <div className={tileClass}>
            <p className={labelClass}>有到</p>
            <p className={valueClass}>{marked > 0 ? `${attended} 堂` : "—"}</p>
            <p className={subClass}>{otherMarks.length > 0 ? otherMarks.join(" · ") : "全部都到了"}</p>
          </div>
        )}
        {review.earlyCount > 0 && (
          <div className={tileClass}>
            <p className={labelClass}>早八</p>
            <p className={valueClass}>{review.earlyCount} 堂</p>
            <p className={subClass}>9 點前的課有到</p>
          </div>
        )}
        {(review.focusMinutes > 0 || review.previousFocusMinutes > 0) && (
          <div className={tileClass}>
            <p className={labelClass}>專注</p>
            <p className={valueClass}>{review.focusMinutes > 0 ? formatFocusTime(review.focusMinutes) : "0 分鐘"}</p>
            <FocusChange now={review.focusMinutes} before={review.previousFocusMinutes} />
          </div>
        )}
        {assignments > 0 && (
          <div className={tileClass}>
            <p className={labelClass}>上週要交的作業</p>
            <p className={valueClass}>
              交了 {review.assignmentsDone}/{assignments}
            </p>
            <p className={subClass}>
              {review.assignmentsOpen > 0 ? `還有 ${review.assignmentsOpen} 份沒打勾` : "全部交了"}
            </p>
          </div>
        )}
      </div>

      {review.badges.length > 0 && (
        <p className="mt-2 text-xs font-black">拿到徽章:{review.badges.map(levelLabel).join("、")}</p>
      )}

      <div className="mt-3 border-t-2 border-ink/10 pt-2 dark:border-white/10">
        <p className="text-xs font-black">這週要注意</p>
        {review.thisWeek.length === 0 ? (
          <p className="mt-0.5 text-xs font-bold text-ink/60 dark:text-white/60">這週沒有考試,也沒有要交的作業</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {review.thisWeek.map((item) => (
              <li key={item.event.id} className="flex gap-2 text-xs font-bold">
                <span className="shrink-0 font-black">{DAY_OF_WEEK_LABELS[dayOfWeekOf(item.event.date)]}</span>
                <span className="min-w-0 truncate">
                  {item.course.name} · {item.event.title}
                  {item.event.kind === "exam" ? "(考試)" : "(要交)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
