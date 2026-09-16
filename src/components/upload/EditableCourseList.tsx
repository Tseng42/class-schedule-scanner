import { useState } from "react";
import { DAY_OF_WEEK_LABELS, type DayOfWeek } from "../../schema/course";
import {
  draftsToCourses,
  extractionToDrafts,
  validateDraft,
  type CourseDraft,
  type RecurrenceType,
} from "../../schema/mapExtraction";
import type { ExtractionResult } from "../../schema/extraction";
import { addCourses } from "../../services/storage/scheduleRepository";
import { dayOfWeekOf } from "../../services/scheduling/dateKey";
import { generateId } from "../../lib/id";

const DAY_OPTIONS: DayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

interface EditableCourseListProps {
  result: ExtractionResult;
  onSaved: (result: { added: number; skipped: number }) => void;
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

  const updateRecurrenceType = (courseLocalId: string, recurrenceType: RecurrenceType) => {
    setDrafts((prev) =>
      prev.map((course) => {
        if (course.localId !== courseLocalId) return course;
        if (recurrenceType === "once") {
          const firstSlot = course.timeSlots[0];
          return {
            ...course,
            recurrenceType,
            timeSlots: firstSlot ? [firstSlot] : course.timeSlots,
          };
        }
        return { ...course, recurrenceType };
      }),
    );
  };

  const updateOnceDate = (courseLocalId: string, date: string) => {
    setDrafts((prev) =>
      prev.map((course) => {
        if (course.localId !== courseLocalId) return course;
        const dayOfWeek = date ? dayOfWeekOf(date) : course.timeSlots[0]?.dayOfWeek;
        return {
          ...course,
          onceDate: date,
          timeSlots: course.timeSlots.map((slot, index) =>
            index === 0 && dayOfWeek ? { ...slot, dayOfWeek } : slot,
          ),
        };
      }),
    );
  };

  const draftErrors = new Map(drafts.map((draft) => [draft.localId, validateDraft(draft)]));
  const canSave = drafts.length > 0 && drafts.every((draft) => draftErrors.get(draft.localId) === null);

  const handleSave = () => {
    const courses = draftsToCourses(drafts);
    const { addedCount, skippedCount } = addCourses(courses);
    onSaved({ added: addedCount, skipped: skippedCount });
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
        {drafts.map((course) => {
          const error = draftErrors.get(course.localId) ?? null;
          return (
            <div
              key={course.localId}
              className={`rounded-3xl border-2 bg-white p-4 dark:bg-white/5 ${
                error ? "border-pink-dark" : "border-ink dark:border-white/80"
              }`}
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

              <div className="mt-3 flex gap-1">
                <button
                  type="button"
                  onClick={() => updateRecurrenceType(course.localId, "weekly")}
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    course.recurrenceType === "weekly"
                      ? "bg-ink text-lime"
                      : "border-2 border-ink/15 text-ink/50 dark:border-white/20 dark:text-white/50"
                  }`}
                >
                  每週重複
                </button>
                <button
                  type="button"
                  onClick={() => updateRecurrenceType(course.localId, "once")}
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    course.recurrenceType === "once"
                      ? "bg-ink text-lime"
                      : "border-2 border-ink/15 text-ink/50 dark:border-white/20 dark:text-white/50"
                  }`}
                >
                  只有一次(補課)
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {course.recurrenceType === "once" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={course.onceDate}
                      onChange={(event) => updateOnceDate(course.localId, event.target.value)}
                      className="rounded-full border-2 border-ink/15 px-3 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                    />
                    {course.timeSlots[0] && (
                      <>
                        <input
                          type="time"
                          value={course.timeSlots[0].startTime}
                          onChange={(event) =>
                            updateTimeSlot(course.localId, course.timeSlots[0].localId, "startTime", event.target.value)
                          }
                          className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                        />
                        <span className="text-xs font-black text-ink/40 dark:text-white/40">–</span>
                        <input
                          type="time"
                          value={course.timeSlots[0].endTime}
                          onChange={(event) =>
                            updateTimeSlot(course.localId, course.timeSlots[0].localId, "endTime", event.target.value)
                          }
                          className="rounded-full border-2 border-ink/15 px-2 py-1 text-xs font-bold text-ink dark:border-white/20 dark:bg-transparent dark:text-white"
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {error && <p className="mt-2 text-xs font-black text-pink-dark">{error}</p>}
            </div>
          );
        })}
      </div>

      {!canSave && (
        <p className="text-sm font-bold text-pink-dark">有課程還沒填完整,請先修正上面標紅框的地方</p>
      )}

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
