import { DAY_OF_WEEK_LABELS, type Course, type DayOfWeek } from "../schema/course";
import {
  draftsToCourses,
  newTimeSlotDraft,
  validateDraft,
  type CourseDraft,
  type RecurrenceType,
} from "../schema/mapExtraction";
import { isSameCourse } from "../services/storage/courseIdentity";
import { dayOfWeekOf } from "../services/scheduling/dateKey";

const DAY_OPTIONS: DayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

interface CourseDraftFormProps {
  draft: CourseDraft;
  onChange: (draft: CourseDraft) => void;
  onSave: () => void;
  /** Omit to hide the 取消 button. */
  onCancel?: () => void;
  /**
   * Pass when the form creates a course rather than editing one: it warns about
   * a duplicate of these, focuses the name field, and doesn't open already red.
   */
  existingCourses?: Course[];
}

/** addCourses silently skips a course that matches an existing one, so say so before the user saves. */
function duplicateError(draft: CourseDraft, courses: Course[]): string | null {
  const [candidate] = draftsToCourses([draft]);
  return courses.some((course) => isSameCourse(course, candidate)) ? "已經有同名稱、同時段的課了" : null;
}

export function CourseDraftForm({ draft, onChange, onSave, onCancel, existingCourses }: CourseDraftFormProps) {
  const isNew = existingCourses !== undefined;
  const error = validateDraft(draft) ?? (isNew ? duplicateError(draft, existingCourses) : null);
  // A blank new form shouldn't open already red; the disabled 儲存 and the focused name field are enough.
  const shownError = isNew && draft.name.trim() === "" ? null : error;

  const updateField = (field: "name" | "teacher" | "location", value: string) => {
    onChange({ ...draft, [field]: value });
  };

  const updateTimeSlot = (
    slotLocalId: string,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: string,
  ) => {
    onChange({
      ...draft,
      timeSlots: draft.timeSlots.map((slot) => (slot.localId === slotLocalId ? { ...slot, [field]: value } : slot)),
    });
  };

  const addTimeSlot = () => {
    onChange({ ...draft, timeSlots: [...draft.timeSlots, newTimeSlotDraft()] });
  };

  const removeTimeSlot = (slotLocalId: string) => {
    onChange({ ...draft, timeSlots: draft.timeSlots.filter((slot) => slot.localId !== slotLocalId) });
  };

  const updateRecurrenceType = (recurrenceType: RecurrenceType) => {
    if (recurrenceType === "once") {
      const firstSlot = draft.timeSlots[0];
      onChange({ ...draft, recurrenceType, timeSlots: firstSlot ? [firstSlot] : draft.timeSlots });
      return;
    }
    onChange({ ...draft, recurrenceType });
  };

  const updateOnceDate = (date: string) => {
    const dayOfWeek = date ? dayOfWeekOf(date) : draft.timeSlots[0]?.dayOfWeek;
    onChange({
      ...draft,
      onceDate: date,
      timeSlots: draft.timeSlots.map((slot, index) => (index === 0 && dayOfWeek ? { ...slot, dayOfWeek } : slot)),
    });
  };

  return (
    <div
      className={`rounded-3xl border-2 bg-white p-4 dark:bg-white/5 ${
        shownError ? "border-pink-dark" : "border-ink dark:border-white/80"
      }`}
    >
      <input
        type="text"
        value={draft.name}
        onChange={(event) => updateField("name", event.target.value)}
        placeholder="課程名稱"
        autoFocus={isNew}
        className="w-full rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-black text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="text"
          value={draft.teacher}
          onChange={(event) => updateField("teacher", event.target.value)}
          placeholder="教師(選填)"
          className="rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
        />
        <input
          type="text"
          value={draft.location}
          onChange={(event) => updateField("location", event.target.value)}
          placeholder="地點(選填)"
          className="rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
        />
      </div>

      <div className="mt-3 flex gap-1">
        <button
          type="button"
          onClick={() => updateRecurrenceType("weekly")}
          className={`rounded-full px-3 py-1 text-xs font-black ${
            draft.recurrenceType === "weekly"
              ? "bg-ink text-lime"
              : "border-2 border-ink/15 text-ink/60 dark:border-white/20 dark:text-white/60"
          }`}
        >
          每週重複
        </button>
        <button
          type="button"
          onClick={() => updateRecurrenceType("once")}
          className={`rounded-full px-3 py-1 text-xs font-black ${
            draft.recurrenceType === "once"
              ? "bg-ink text-lime"
              : "border-2 border-ink/15 text-ink/60 dark:border-white/20 dark:text-white/60"
          }`}
        >
          只有一次(補課)
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {draft.recurrenceType === "once" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={draft.onceDate}
              onChange={(event) => updateOnceDate(event.target.value)}
              onClick={(event) => event.currentTarget.showPicker?.()}
              className="rounded-full border-2 border-ink/15 px-3 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
            />
            {draft.timeSlots[0] && (
              <>
                <input
                  type="time"
                  value={draft.timeSlots[0].startTime}
                  onChange={(event) => updateTimeSlot(draft.timeSlots[0].localId, "startTime", event.target.value)}
                  className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                />
                <span className="text-xs font-black text-ink/60 dark:text-white/60">–</span>
                <input
                  type="time"
                  value={draft.timeSlots[0].endTime}
                  onChange={(event) => updateTimeSlot(draft.timeSlots[0].localId, "endTime", event.target.value)}
                  className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                />
              </>
            )}
          </div>
        ) : (
          <>
            {draft.timeSlots.map((slot) => (
              <div key={slot.localId} className="flex flex-wrap items-center gap-2">
                <select
                  value={slot.dayOfWeek}
                  onChange={(event) => updateTimeSlot(slot.localId, "dayOfWeek", event.target.value)}
                  className="rounded-full border-2 border-ink/15 bg-lime px-3 py-1 text-xs font-black text-ink dark:border-white/20"
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {DAY_OF_WEEK_LABELS[day]}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(event) => updateTimeSlot(slot.localId, "startTime", event.target.value)}
                  className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                />
                <span className="text-xs font-black text-ink/60 dark:text-white/60">–</span>
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(event) => updateTimeSlot(slot.localId, "endTime", event.target.value)}
                  className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeTimeSlot(slot.localId)}
                  disabled={draft.timeSlots.length <= 1}
                  className="text-xs font-black text-ink/60 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60"
                >
                  移除
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTimeSlot}
              className="self-start text-xs font-black text-ink underline decoration-2 underline-offset-2 dark:text-white"
            >
              + 新增時段
            </button>
          </>
        )}
      </div>

      {shownError && <p className="mt-2 text-xs font-black text-red-700 dark:text-pink">{shownError}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={error !== null}
          className="rounded-full bg-lime px-4 py-2 text-sm font-black text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          儲存
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
