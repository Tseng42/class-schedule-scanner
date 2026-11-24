import {
  daysUntil,
  EXAM_WEEK_DAYS,
  formatExamCountdown,
  prepProgress,
  type ScheduledEvent,
} from "../services/scheduling/events";
import { RollingNumber } from "./RollingNumber";

interface ExamCountdownProps {
  exams: ScheduledEvent[];
  now: Date;
  /** `source` is the tapped row, for the 複習清單 to grow out of. */
  onOpen: (item: ScheduledEvent, source: HTMLElement) => void;
}

/** Home-screen card for exams in the next two weeks, each with how much of its 複習清單 is done. */
export function ExamCountdown({ exams, now, onOpen }: ExamCountdownProps) {
  if (exams.length === 0) return null;
  const isExamWeek = exams.filter((item) => daysUntil(item.event, now) <= EXAM_WEEK_DAYS).length >= 2;

  return (
    <section className="rounded-3xl border-2 border-ink bg-white p-4 text-ink dark:border-white/20 dark:bg-white/5 dark:text-white">
      <h2 className="text-sm font-black">{isExamWeek ? "考試週" : "考試倒數"}</h2>
      <ul className="mt-2 flex flex-col">
        {exams.map((item) => {
          const { event, course } = item;
          const { done, total } = prepProgress(event);
          const days = daysUntil(event, now);
          return (
            <li key={event.id} className="border-t-2 border-ink/10 first:border-t-0 dark:border-white/10">
              <button
                type="button"
                onClick={(event) => onOpen(item, event.currentTarget)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">
                    {course.name} · {event.title}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs font-bold text-ink/60 dark:text-white/60">
                    {total > 0 ? (
                      <>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15" aria-hidden="true">
                          <span
                            className="block h-full rounded-full bg-ink dark:bg-lime"
                            style={{ width: `${(done / total) * 100}%` }}
                          />
                        </span>
                        已複習 <RollingNumber value={`${done}/${total}`} className="tabular-nums" />
                      </>
                    ) : (
                      "還沒有複習清單,點一下加"
                    )}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                    days <= 1 ? "bg-ink text-lime dark:bg-lime dark:text-ink" : "bg-ink/5 dark:bg-white/10"
                  }`}
                >
                  <RollingNumber value={formatExamCountdown(event, now)} direction="down" className="tabular-nums" />
                  {event.time && days <= 1 ? ` ${event.time}` : ""}
                </span>
                <span aria-hidden="true" className="text-base leading-none font-black opacity-40">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
