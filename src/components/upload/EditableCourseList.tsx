import { useState } from "react";
import { DAY_OF_WEEK_LABELS, type DayOfWeek } from "../../schema/course";
import { draftsToCourses, extractionToDrafts, type CourseDraft } from "../../schema/mapExtraction";
import type { ExtractionResult } from "../../schema/extraction";
import { addCourses } from "../../services/storage/scheduleRepository";
import { generateId } from "../../lib/id";

const DAY_OPTIONS: DayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

interface EditableCourseListProps {
  result: ExtractionResult;
  onSaved: (savedCount: number) => void;
}

export function EditableCourseList({ result, onSaved }: EditableCourseListProps) {
  const [drafts, setDrafts] = useState<CourseDraft[]>(() => extractionToDrafts(result));

  const updateCourse = (
    localId: string,
    field: "name" | "teacher" | "location",
    value: string,
  ) => {
    setDrafts((prev) =>
      prev.map((course) => (course.localId === localId ? { ...course, [field]: value } : course)),
    );
  };

  const removeCourse = (localId: string) => {
    setDrafts((prev) => prev.filter((course) => course.localId !== localId));
  };

  const updateTimeSlot = (
    courseLocalId: string,
    slotLocalId: string,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: string,
  ) => {
    setDrafts((prev) =>
      prev.map((course) =>
        course.localId !== courseLocalId
          ? course
          : {
              ...course,
              timeSlots: course.timeSlots.map((slot) =>
                slot.localId === slotLocalId ? { ...slot, [field]: value } : slot,
              ),
            },
      ),
    );
  };

  const addTimeSlot = (courseLocalId: string) => {
    setDrafts((prev) =>
      prev.map((course) =>
        course.localId !== courseLocalId
          ? course
          : {
              ...course,
              timeSlots: [
                ...course.timeSlots,
                { localId: generateId(), dayOfWeek: "MO", startTime: "09:00", endTime: "10:00" },
              ],
            },
      ),
    );
  };

  const removeTimeSlot = (courseLocalId: string, slotLocalId: string) => {
    setDrafts((prev) =>
      prev.map((course) =>
        course.localId !== courseLocalId
          ? course
          : { ...course, timeSlots: course.timeSlots.filter((slot) => slot.localId !== slotLocalId) },
      ),
    );
  };

  const canSave =
    drafts.length > 0 && drafts.every((course) => course.name.trim() !== "" && course.timeSlots.length > 0);

  const handleSave = () => {
    const courses = draftsToCourses(drafts);
    addCourses(courses);
    onSaved(courses.length);
  };

  if (drafts.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 text-center font-bold text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
        沒有課程可以儲存了
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {drafts.map((course) => (
          <div
            key={course.localId}
            className="rounded-3xl border-2 border-ink bg-white p-4 dark:border-white/80 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-2">
              <input
                type="text"
                value={course.name}
                onChange={(event) => updateCourse(course.localId, "name", event.target.value)}
                placeholder="課程名稱"
                className="w-full rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-black text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
              />
              <button
                type="button"
                onClick={() => removeCourse(course.localId)}
                className="shrink-0 rounded-full px-2 py-1 text-xs font-black text-ink/40 hover:bg-pink hover:text-ink dark:text-white/40"
              >
                刪除
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={course.teacher}
                onChange={(event) => updateCourse(course.localId, "teacher", event.target.value)}
                placeholder="教師(選填)"
                className="rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
              />
              <input
                type="text"
                value={course.location}
                onChange={(event) => updateCourse(course.localId, "location", event.target.value)}
                placeholder="地點(選填)"
                className="rounded-xl border-2 border-ink/15 px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {course.timeSlots.map((slot) => (
                <div key={slot.localId} className="flex flex-wrap items-center gap-2">
                  <select
                    value={slot.dayOfWeek}
                    onChange={(event) =>
                      updateTimeSlot(course.localId, slot.localId, "dayOfWeek", event.target.value)
                    }
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
                    onChange={(event) =>
                      updateTimeSlot(course.localId, slot.localId, "startTime", event.target.value)
                    }
                    className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                  />
                  <span className="text-xs font-black text-ink/40 dark:text-white/40">–</span>
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(event) =>
                      updateTimeSlot(course.localId, slot.localId, "endTime", event.target.value)
                    }
                    className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeTimeSlot(course.localId, slot.localId)}
                    disabled={course.timeSlots.length <= 1}
                    className="text-xs font-black text-ink/40 hover:text-pink-dark disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/40"
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addTimeSlot(course.localId)}
                className="self-start text-xs font-black text-ink underline decoration-2 underline-offset-2 dark:text-white"
              >
                + 新增時段
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="self-start rounded-full bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        確認儲存({drafts.length} 堂課)
      </button>
    </div>
  );
}
