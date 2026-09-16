import type { Course, DayOfWeek, Recurrence, TimeSlot } from "./course";
import type { ExtractionResult } from "./extraction";
import { generateId } from "../lib/id";

export interface TimeSlotDraft {
  localId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export type RecurrenceType = "weekly" | "once";

export interface CourseDraft {
  localId: string;
  name: string;
  teacher: string;
  location: string;
  timeSlots: TimeSlotDraft[];
  recurrenceType: RecurrenceType;
  /** Only meaningful when recurrenceType is "once", format YYYY-MM-DD. */
  onceDate: string;
}

export function extractionToDrafts(result: ExtractionResult): CourseDraft[] {
  return result.courses.map((course) => ({
    localId: generateId(),
    name: course.name,
    teacher: course.teacher ?? "",
    location: course.location ?? "",
    timeSlots: course.timeSlots.map((slot) => ({
      localId: generateId(),
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    recurrenceType: "weekly",
    onceDate: "",
  }));
}

export function courseToDraft(course: Course): CourseDraft {
  return {
    localId: course.id,
    name: course.name,
    teacher: course.teacher ?? "",
    location: course.location ?? "",
    timeSlots: course.timeSlots.map((slot) => ({
      localId: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    recurrenceType: course.recurrence.type,
    onceDate: course.recurrence.type === "once" ? course.recurrence.date : "",
  };
}

function draftRecurrence(draft: CourseDraft): Recurrence {
  return draft.recurrenceType === "once" ? { type: "once", date: draft.onceDate } : { type: "weekly" };
}

/** Returns a human-readable problem with this draft, or null if it's ready to save. */
export function validateDraft(draft: CourseDraft): string | null {
  if (draft.name.trim() === "") return "請填課程名稱";
  if (draft.timeSlots.length === 0) return "這堂課沒有時段,請新增一個或刪除這堂課";
  for (const slot of draft.timeSlots) {
    if (slot.startTime >= slot.endTime) return "結束時間要晚於開始時間";
  }
  if (draft.recurrenceType === "once" && !draft.onceDate) return "請選擇日期";
  return null;
}

export function draftsToCourses(drafts: CourseDraft[]): Course[] {
  const timestamp = new Date().toISOString();
  return drafts.map((draft) => {
    const timeSlots: TimeSlot[] = draft.timeSlots.map((slot) => ({
      id: generateId(),
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
    return {
      id: generateId(),
      name: draft.name.trim(),
      teacher: draft.teacher.trim() || undefined,
      location: draft.location.trim() || undefined,
      timeSlots,
      recurrence: draftRecurrence(draft),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

/** Applies edits from a draft back onto an existing course, preserving its id/createdAt. */
export function draftToCourse(draft: CourseDraft, original: Course): Course {
  const timeSlots: TimeSlot[] = draft.timeSlots.map((slot) => ({
    id: slot.localId,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
  return {
    ...original,
    name: draft.name.trim(),
    teacher: draft.teacher.trim() || undefined,
    location: draft.location.trim() || undefined,
    timeSlots,
    recurrence: draftRecurrence(draft),
    updatedAt: new Date().toISOString(),
  };
}
