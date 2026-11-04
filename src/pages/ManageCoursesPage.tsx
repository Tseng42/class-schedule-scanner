import { useState } from "react";
import { DAY_OF_WEEK_LABELS, type Course, type DayOfWeek } from "../schema/course";
import {
  courseToDraft,
  draftsToCourses,
  draftToCourse,
  validateDraft,
  type CourseDraft,
  type RecurrenceType,
  type TimeSlotDraft,
} from "../schema/mapExtraction";
import { addCourses, loadSchedule, removeCourse, updateCourse } from "../services/storage/scheduleRepository";
import { isSameCourse } from "../services/storage/courseIdentity";
import { dayOfWeekOf } from "../services/scheduling/dateKey";
import { generateId } from "../lib/id";
import { CourseExtras } from "../components/CourseExtras";
import { ConfirmDialog } from "../components/ConfirmDialog";

const DAY_OPTIONS: DayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** Stands in for editingId while the form is creating a course instead of editing one. */
const NEW_COURSE_ID = "new";

interface ManageCoursesPageProps {
  onNavigateUpload: () => void;
  /** Open with the new-course form already showing, e.g. when arriving from the 課表 empty state. */
  startAdding?: boolean;
}

function describeSchedule(course: Course): string {
  if (course.recurrence.type === "once") {
    const slot = course.timeSlots[0];
    return slot
      ? `${course.recurrence.date} ${slot.startTime}–${slot.endTime}(單次)`
      : `${course.recurrence.date}(單次)`;
  }
  return course.timeSlots
    .map((slot) => `${DAY_OF_WEEK_LABELS[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`)
    .join("、");
}

function newTimeSlot(): TimeSlotDraft {
  return { localId: generateId(), dayOfWeek: "MO", startTime: "09:00", endTime: "10:00" };
}

function blankDraft(): CourseDraft {
  return {
    localId: generateId(),
    name: "",
    teacher: "",
    location: "",
    timeSlots: [newTimeSlot()],
    recurrenceType: "weekly",
    onceDate: "",
  };
}

/** addCourses silently skips a course that matches an existing one, so say so before the user saves. */
function duplicateError(draft: CourseDraft, courses: Course[]): string | null {
  const [candidate] = draftsToCourses([draft]);
  return courses.some((course) => isSameCourse(course, candidate)) ? "已經有同名稱、同時段的課了" : null;
}

export function ManageCoursesPage({ onNavigateUpload, startAdding = false }: ManageCoursesPageProps) {
  const [courses, setCourses] = useState<Course[]>(() => loadSchedule().courses);
  const [editingId, setEditingId] = useState<string | null>(() => (startAdding ? NEW_COURSE_ID : null));
  const [draft, setDraft] = useState<CourseDraft | null>(() => (startAdding ? blankDraft() : null));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const isAddingNew = editingId === NEW_COURSE_ID;

  const withStorageErrorHandling = <T,>(action: () => T): T | undefined => {
    try {
      setStorageError(null);
      return action();
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "儲存失敗");
      return undefined;
    }
  };

  const startNew = () => {
    setEditingId(NEW_COURSE_ID);
    setDraft(blankDraft());
  };

  const startEdit = (course: Course) => {
    setEditingId(course.id);
    setDraft(courseToDraft(course));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!draft || !editingId) return;
    if (validateDraft(draft)) return;
    if (isAddingNew) {
      const result = withStorageErrorHandling(() => addCourses(draftsToCourses([draft])));
      if (!result || result.addedCount === 0) return;
      setCourses(result.schedule.courses);
      cancelEdit();
      return;
    }
    const original = courses.find((course) => course.id === editingId);
    if (!original) return;
    const updated = withStorageErrorHandling(() => updateCourse(editingId, draftToCourse(draft, original)));
    if (!updated) return;
    setCourses(updated.courses);
    cancelEdit();
  };

  const handleExtrasChange = (next: Course) => {
    const updated = withStorageErrorHandling(() => updateCourse(next.id, next));
    if (updated) setCourses(updated.courses);
  };

  const handleDelete = (courseId: string) => {
    const updated = withStorageErrorHandling(() => removeCourse(courseId));
    if (!updated) return;
    setCourses(updated.courses);
    if (editingId === courseId) cancelEdit();
  };

  const updateField = (field: "name" | "teacher" | "location", value: string) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateTimeSlot = (
    slotLocalId: string,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: string,
  ) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            timeSlots: prev.timeSlots.map((slot) =>
              slot.localId === slotLocalId ? { ...slot, [field]: value } : slot,
            ),
          }
        : prev,
    );
  };

  const addTimeSlot = () => {
    setDraft((prev) => (prev ? { ...prev, timeSlots: [...prev.timeSlots, newTimeSlot()] } : prev));
  };

  const removeTimeSlot = (slotLocalId: string) => {
    setDraft((prev) =>
      prev ? { ...prev, timeSlots: prev.timeSlots.filter((slot) => slot.localId !== slotLocalId) } : prev,
    );
  };

  const updateRecurrenceType = (recurrenceType: RecurrenceType) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (recurrenceType === "once") {
        const firstSlot = prev.timeSlots[0];
        return { ...prev, recurrenceType, timeSlots: firstSlot ? [firstSlot] : prev.timeSlots };
      }
      return { ...prev, recurrenceType };
    });
  };

  const updateOnceDate = (date: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const dayOfWeek = date ? dayOfWeekOf(date) : prev.timeSlots[0]?.dayOfWeek;
      return {
        ...prev,
        onceDate: date,
        timeSlots: prev.timeSlots.map((slot, index) =>
          index === 0 && dayOfWeek ? { ...slot, dayOfWeek } : slot,
        ),
      };
    });
  };

  if (courses.length === 0 && !isAddingNew) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <p className="text-2xl font-black text-ink dark:text-white">還沒有課表資料</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={startNew}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            + 新增課程
          </button>
          <button
            type="button"
            onClick={onNavigateUpload}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            掃描第一張課表
          </button>
        </div>
      </main>
    );
  }

  const draftError = draft
    ? (validateDraft(draft) ?? (isAddingNew ? duplicateError(draft, courses) : null))
    : null;
  // A blank new form shouldn't open already red; the disabled 儲存 and the focused name field are enough.
  const shownDraftError = isAddingNew && draft?.name.trim() === "" ? null : draftError;

  const renderDraftForm = (key: string, current: CourseDraft) => (
    <div
      key={key}
      className={`rounded-3xl border-2 bg-white p-4 dark:bg-white/5 ${
        shownDraftError ? "border-pink-dark" : "border-ink dark:border-white/80"
      }`}
    >
      <input
        type="text"
        value={current.name}
        onChange={(event) => updateField("name", event.target.value)}
        placeholder="課程名稱"
        autoFocus={isAddingNew}
        className="w-full rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-black text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="text"
          value={current.teacher}
          onChange={(event) => updateField("teacher", event.target.value)}
          placeholder="教師(選填)"
          className="rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
        />
        <input
          type="text"
          value={current.location}
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
            current.recurrenceType === "weekly"
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
            current.recurrenceType === "once"
              ? "bg-ink text-lime"
              : "border-2 border-ink/15 text-ink/60 dark:border-white/20 dark:text-white/60"
          }`}
        >
          只有一次(補課)
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {current.recurrenceType === "once" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={current.onceDate}
              onChange={(event) => updateOnceDate(event.target.value)}
              onClick={(event) => event.currentTarget.showPicker?.()}
              className="rounded-full border-2 border-ink/15 px-3 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
            />
            {current.timeSlots[0] && (
              <>
                <input
                  type="time"
                  value={current.timeSlots[0].startTime}
                  onChange={(event) =>
                    updateTimeSlot(current.timeSlots[0].localId, "startTime", event.target.value)
                  }
                  className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                />
                <span className="text-xs font-black text-ink/60 dark:text-white/60">–</span>
                <input
                  type="time"
                  value={current.timeSlots[0].endTime}
                  onChange={(event) =>
                    updateTimeSlot(current.timeSlots[0].localId, "endTime", event.target.value)
                  }
                  className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                />
              </>
            )}
          </div>
        ) : (
          <>
            {current.timeSlots.map((slot) => (
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
                  disabled={current.timeSlots.length <= 1}
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

      {shownDraftError && <p className="mt-2 text-xs font-black text-red-700 dark:text-pink">{shownDraftError}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={saveEdit}
          disabled={draftError !== null}
          className="rounded-full bg-lime px-4 py-2 text-sm font-black text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          儲存
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="rounded-full px-4 py-2 text-sm font-black text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white"
        >
          取消
        </button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">所有課程</h1>
          <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">共 {courses.length} 堂課</p>
        </div>
        {!isAddingNew && (
          <button
            type="button"
            onClick={startNew}
            className="shrink-0 rounded-full border-2 border-ink bg-lime px-4 py-2.5 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            + 新增課程
          </button>
        )}
      </header>

      {storageError && (
        <div className="rounded-3xl bg-pink p-4 text-sm font-bold text-ink">{storageError}</div>
      )}

      {isAddingNew && draft && renderDraftForm(NEW_COURSE_ID, draft)}

      <div className="flex flex-col gap-4">
        {courses.map((course) => {
          if (editingId === course.id && draft) return renderDraftForm(course.id, draft);

          return (
            <div
              key={course.id}
              className="rounded-3xl border-2 border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-ink dark:text-white">{course.name}</p>
                  <p className="mt-1 text-xs font-bold text-ink/60 dark:text-white/60">
                    {describeSchedule(course)}
                  </p>
                  {(course.teacher || course.location) && (
                    <p className="mt-1 text-xs font-bold text-ink/60 dark:text-white/60">
                      {[course.teacher, course.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(course)}
                    className="rounded-full px-3 py-1.5 text-xs font-black text-ink/60 hover:bg-ink/5 hover:text-ink dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(course.id)}
                    className="rounded-full px-3 py-1.5 text-xs font-black text-ink/60 hover:bg-pink hover:text-ink dark:text-white/60"
                  >
                    刪除
                  </button>
                </div>
              </div>
              <CourseExtras course={course} onChange={handleExtrasChange} />
            </div>
          );
        })}
      </div>

      {pendingDeleteId && (
        <ConfirmDialog
          title="刪除這堂課?"
          message={`確定要刪除「${courses.find((course) => course.id === pendingDeleteId)?.name ?? ""}」嗎?這個動作無法復原。`}
          confirmLabel="刪除"
          onConfirm={() => {
            handleDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </main>
  );
}
