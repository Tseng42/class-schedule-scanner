import { useState } from "react";
import {
  EVENT_KIND_LABELS,
  type Cancellation,
  type Course,
  type CourseEvent,
  type EventKind,
} from "../schema/course";
import { generateId } from "../lib/id";
import { formatDateRange } from "../lib/formatDate";

interface CourseExtrasProps {
  course: Course;
  onChange: (next: Course) => void;
}

type OpenForm = "cancel" | "event" | "note" | null;

const KINDS: EventKind[] = ["exam", "assignment", "other"];

const TITLE_PLACEHOLDERS: Record<EventKind, string> = {
  exam: "例如 期中考",
  assignment: "例如 作業一",
  other: "例如 分組報告",
};

const REMIND_OPTIONS: { label: string; value: number }[] = [
  { label: "不提醒", value: 0 },
  { label: "1 小時前", value: 60 },
  { label: "1 天前", value: 1440 },
  { label: "2 天前", value: 2880 },
  { label: "1 週前", value: 10080 },
];

const inputClass =
  "rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white";

const actionButtonClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-black transition-transform active:scale-95 ${
    active
      ? "bg-ink text-lime dark:bg-lime dark:text-ink"
      : "border-2 border-ink/15 text-ink/70 hover:border-ink hover:text-ink dark:border-white/20 dark:text-white/70 dark:hover:border-white dark:hover:text-white"
  }`;

function formatEventWhen(event: CourseEvent): string {
  const [, month, day] = event.date.split("-").map(Number);
  return `${month}/${day}${event.time ? ` ${event.time}` : ""}`;
}

function formatRemind(minutes: number | undefined): string {
  if (!minutes) return "不提醒";
  return `${REMIND_OPTIONS.find((option) => option.value === minutes)?.label ?? `${minutes} 分鐘前`}提醒`;
}

export function CourseExtras({ course, onChange }: CourseExtrasProps) {
  const [openForm, setOpenForm] = useState<OpenForm>(null);

  const [cancelStart, setCancelStart] = useState("");
  const [cancelEnd, setCancelEnd] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [eventKind, setEventKind] = useState<EventKind>("exam");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventRemind, setEventRemind] = useState(1440);
  const [eventError, setEventError] = useState<string | null>(null);

  const [noteDraft, setNoteDraft] = useState("");

  const cancellations = course.cancellations ?? [];
  const events = course.events ?? [];

  const save = (patch: Partial<Course>) => {
    onChange({ ...course, ...patch, updatedAt: new Date().toISOString() });
  };

  const toggleForm = (form: Exclude<OpenForm, null>) => {
    if (openForm === form) {
      setOpenForm(null);
      return;
    }
    if (form === "note") setNoteDraft(course.notes ?? "");
    setOpenForm(form);
  };

  const addCancellation = () => {
    if (!cancelStart) {
      setCancelError("請選擇日期");
      return;
    }
    const endDate = cancelEnd || cancelStart;
    if (endDate < cancelStart) {
      setCancelError("結束日期不能早於開始日期");
      return;
    }
    const next: Cancellation = {
      id: generateId(),
      startDate: cancelStart,
      endDate,
      reason: cancelReason.trim() || undefined,
    };
    save({ cancellations: [...cancellations, next].sort((a, b) => a.startDate.localeCompare(b.startDate)) });
    setCancelStart("");
    setCancelEnd("");
    setCancelReason("");
    setCancelError(null);
    setOpenForm(null);
  };

  const addEvent = () => {
    if (!eventDate) {
      setEventError("請選擇日期");
      return;
    }
    const next: CourseEvent = {
      id: generateId(),
      kind: eventKind,
      title: eventTitle.trim() || EVENT_KIND_LABELS[eventKind],
      date: eventDate,
      time: eventTime || undefined,
      remindMinutes: eventRemind || undefined,
    };
    const sorted = [...events, next].sort((a, b) =>
      `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
    );
    save({ events: sorted });
    setEventTitle("");
    setEventDate("");
    setEventTime("");
    setEventError(null);
    setOpenForm(null);
  };

  const saveNote = () => {
    save({ notes: noteDraft.trim() || undefined });
    setOpenForm(null);
  };

  return (
    <div className="mt-3 flex flex-col gap-2 border-t-2 border-ink/10 pt-3 dark:border-white/10">
      {course.notes && openForm !== "note" && (
        <p className="text-xs font-bold text-ink/70 dark:text-white/70">備註:{course.notes}</p>
      )}

      {cancellations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cancellations.map((item) => (
            <span
              key={item.id}
              className="flex items-center gap-1.5 rounded-full bg-pink py-1 pr-1.5 pl-3 text-xs font-black text-ink"
            >
              停課 {formatDateRange(item.startDate, item.endDate)}
              {item.reason ? ` · ${item.reason}` : ""}
              <button
                type="button"
                aria-label="刪除這筆停課"
                onClick={() => save({ cancellations: cancellations.filter((other) => other.id !== item.id) })}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/10 hover:bg-ink hover:text-pink"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {events.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-sky py-1.5 pr-1.5 pl-3 text-xs font-black text-ink"
            >
              <span className="min-w-0">
                <span className="mr-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] text-sky">
                  {EVENT_KIND_LABELS[item.kind]}
                </span>
                {item.title} · {formatEventWhen(item)}
                <span className="font-bold opacity-60"> · {formatRemind(item.remindMinutes)}</span>
              </span>
              <button
                type="button"
                aria-label="刪除這個事項"
                onClick={() => save({ events: events.filter((other) => other.id !== item.id) })}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 hover:bg-ink hover:text-sky"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => toggleForm("cancel")} className={actionButtonClass(openForm === "cancel")}>
          + 停課
        </button>
        <button type="button" onClick={() => toggleForm("event")} className={actionButtonClass(openForm === "event")}>
          + 考試/作業
        </button>
        <button type="button" onClick={() => toggleForm("note")} className={actionButtonClass(openForm === "note")}>
          {course.notes ? "編輯備註" : "+ 備註"}
        </button>
      </div>

      {openForm === "cancel" && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 p-3 dark:border-white/10">
          <p className="text-xs font-bold text-ink/60 dark:text-white/60">
            這段期間內這堂課都不用上(整週停課就選一段日期,例如連續三週)。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={cancelStart}
              onChange={(event) => {
                setCancelStart(event.target.value);
                setCancelError(null);
              }}
              onClick={(event) => event.currentTarget.showPicker?.()}
              aria-label="停課開始日期"
              className={inputClass}
            />
            <span className="text-xs font-black text-ink/40 dark:text-white/40">到</span>
            <input
              type="date"
              value={cancelEnd}
              onChange={(event) => {
                setCancelEnd(event.target.value);
                setCancelError(null);
              }}
              onClick={(event) => event.currentTarget.showPicker?.()}
              aria-label="停課結束日期(選填)"
              className={inputClass}
            />
            <span className="text-xs font-bold text-ink/40 dark:text-white/40">(只有一天可以不填)</span>
          </div>
          <input
            type="text"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="原因(選填),例如 國慶連假"
            className={inputClass}
          />
          {cancelError && <p className="text-xs font-black text-pink-dark">{cancelError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addCancellation}
              className="rounded-full bg-lime px-4 py-2 text-sm font-black text-ink transition-transform active:scale-95"
            >
              新增停課
            </button>
            <button
              type="button"
              onClick={() => setOpenForm(null)}
              className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {openForm === "event" && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 p-3 dark:border-white/10">
          <div className="flex gap-1">
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setEventKind(kind)}
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  eventKind === kind
                    ? "bg-ink text-lime"
                    : "border-2 border-ink/15 text-ink/50 dark:border-white/20 dark:text-white/50"
                }`}
              >
                {EVENT_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={eventTitle}
            onChange={(event) => setEventTitle(event.target.value)}
            placeholder={TITLE_PLACEHOLDERS[eventKind]}
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={eventDate}
              onChange={(event) => {
                setEventDate(event.target.value);
                setEventError(null);
              }}
              onClick={(event) => event.currentTarget.showPicker?.()}
              aria-label="事項日期"
              className={inputClass}
            />
            <input
              type="time"
              value={eventTime}
              onChange={(event) => setEventTime(event.target.value)}
              onClick={(event) => event.currentTarget.showPicker?.()}
              aria-label="事項時間(選填)"
              className={inputClass}
            />
            <span className="text-xs font-bold text-ink/40 dark:text-white/40">(時間可以不填)</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-black text-ink/70 dark:text-white/70">
            提醒
            <select
              value={eventRemind}
              onChange={(event) => setEventRemind(Number(event.target.value))}
              className="rounded-full border-2 border-ink/15 bg-lime px-3 py-1 text-xs font-black text-ink dark:border-white/20"
            >
              {REMIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {eventError && <p className="text-xs font-black text-pink-dark">{eventError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addEvent}
              className="rounded-full bg-lime px-4 py-2 text-sm font-black text-ink transition-transform active:scale-95"
            >
              新增事項
            </button>
            <button
              type="button"
              onClick={() => setOpenForm(null)}
              className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {openForm === "note" && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 p-3 dark:border-white/10">
          <input
            type="text"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="例如 帶計算機、教室改到 B203"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveNote}
              className="rounded-full bg-lime px-4 py-2 text-sm font-black text-ink transition-transform active:scale-95"
            >
              儲存備註
            </button>
            <button
              type="button"
              onClick={() => setOpenForm(null)}
              className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
