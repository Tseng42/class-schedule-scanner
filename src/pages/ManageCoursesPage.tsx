import { useState } from "react";
import { DAY_OF_WEEK_LABELS, type Course } from "../schema/course";
import {
  blankCourseDraft,
  courseToDraft,
  draftsToCourses,
  draftToCourse,
  validateDraft,
  type CourseDraft,
} from "../schema/mapExtraction";
import { addCourses, loadSchedule, removeCourse, updateCourse } from "../services/storage/scheduleRepository";
import { CourseDraftForm } from "../components/CourseDraftForm";
import { CourseExtras } from "../components/CourseExtras";
import { ConfirmDialog } from "../components/ConfirmDialog";

/** Stands in for editingId while the form is creating a course instead of editing one. */
const NEW_COURSE_ID = "new";

interface ManageCoursesPageProps {
  onAddCourse: () => void;
  onNavigateUpload: () => void;
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

export function ManageCoursesPage({ onAddCourse, onNavigateUpload }: ManageCoursesPageProps) {
  const [courses, setCourses] = useState<Course[]>(() => loadSchedule().courses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
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
    setDraft(blankCourseDraft());
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

  if (courses.length === 0 && !isAddingNew) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <p className="text-2xl font-black text-ink dark:text-white">還沒有課表資料</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onAddCourse}
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

      {isAddingNew && draft && (
        <CourseDraftForm
          draft={draft}
          onChange={setDraft}
          onSave={saveEdit}
          onCancel={cancelEdit}
          existingCourses={courses}
        />
      )}

      <div className="flex flex-col gap-4">
        {courses.map((course) => {
          if (editingId === course.id && draft) {
            return (
              <CourseDraftForm
                key={course.id}
                draft={draft}
                onChange={setDraft}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            );
          }

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
