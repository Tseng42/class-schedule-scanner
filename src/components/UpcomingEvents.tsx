import { useState } from "react";
import { EVENT_KIND_LABELS } from "../schema/course";
import { tapHaptic } from "../lib/haptics";
import { daysUntil, formatDaysUntil, isTask, type HomeEvents, type ScheduledEvent } from "../services/scheduling/events";

/** Overdue to-dos shown before the rest fold behind a button, so a backlog doesn't bury what's next. */
const OVERDUE_PREVIEW = 3;

interface UpcomingEventsProps {
  events: HomeEvents;
  now: Date;
  onToggleDone: (item: ScheduledEvent) => void;
  error: string | null;
}

function EventRow({ item, now, onToggleDone }: { item: ScheduledEvent; now: Date; onToggleDone: (item: ScheduledEvent) => void }) {
  const { event, course } = item;
  const days = daysUntil(event, now);
  const task = isTask(event);
  const done = Boolean(event.done);
  const overdue = task && !done && days < 0;
  const title = event.title || EVENT_KIND_LABELS[event.kind];

  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3.5 dark:border-white/10 dark:bg-white/5">
      {task && (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${title}(${course.name})做完了`}
          onClick={() => {
            tapHaptic();
            onToggleDone(item);
          }}
          className="-m-2 grid shrink-0 place-items-center p-2"
        >
          <span
            aria-hidden="true"
            className={`grid size-7 place-items-center rounded-lg border-2 text-sm font-black transition-colors ${
              done
                ? "border-ink bg-ink text-lime dark:border-lime dark:bg-lime dark:text-ink"
                : "border-ink bg-white text-transparent dark:border-white dark:bg-transparent"
            }`}
          >
            <span className="check-mark" data-on={done}>
              ✓
            </span>
          </span>
        </button>
      )}
      <div className={`min-w-0 flex-1 ${done ? "opacity-50" : ""}`}>
        <p className="font-black text-ink dark:text-white">
          <span className="mr-2 rounded-full bg-sky px-2 py-0.5 text-[10px] text-ink">{EVENT_KIND_LABELS[event.kind]}</span>
          {event.urgent && !done && (
            <span className="mr-2 rounded-full bg-red-700 px-2 py-0.5 text-[10px] text-white dark:bg-pink dark:text-ink">急</span>
          )}
          <span className={done ? "line-through" : ""}>{title}</span>
        </p>
        <p className="mt-0.5 text-xs font-bold text-ink/60 dark:text-white/60">{course.name}</p>
      </div>
      <span
        className={`shrink-0 text-right text-xs font-black ${
          overdue ? "text-red-700 dark:text-pink" : "text-ink dark:text-white"
        } ${done ? "opacity-50" : ""}`}
      >
        {done ? "完成" : formatDaysUntil(days)}
        {!done && event.time && days >= 0 && (
          <span className="block font-bold text-ink/60 dark:text-white/60">{event.time}</span>
        )}
      </span>
    </li>
  );
}

/** The home screen's 近期事項: 急 first, then overdue to-dos, then what's coming up. */
export function UpcomingEvents({ events, now, onToggleDone, error }: UpcomingEventsProps) {
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const { urgent, overdue, upcoming } = events;
  if (urgent.length + overdue.length + upcoming.length === 0 && !error) return null;

  const shownOverdue = showAllOverdue ? overdue : overdue.slice(0, OVERDUE_PREVIEW);
  const hiddenOverdue = overdue.length - shownOverdue.length;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-black tracking-wide text-ink/60 uppercase dark:text-white/60">近期事項</h2>
      <ul className="flex flex-col gap-2">
        {[...urgent, ...shownOverdue].map((item) => (
          <EventRow key={item.event.id} item={item} now={now} onToggleDone={onToggleDone} />
        ))}
        {hiddenOverdue > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setShowAllOverdue(true)}
              className="w-full rounded-2xl border-2 border-dashed border-ink/20 p-3 text-sm font-black text-ink dark:border-white/20 dark:text-white"
            >
              還有 {hiddenOverdue} 份過期沒勾的
            </button>
          </li>
        )}
        {upcoming.map((item) => (
          <EventRow key={item.event.id} item={item} now={now} onToggleDone={onToggleDone} />
        ))}
      </ul>
      {error && <p className="card-error text-sm font-bold">{error}</p>}
    </section>
  );
}
