import type { Course, DayOfWeek, TimeSlot } from "./course";
import type { ExtractionResult } from "./extraction";
import { generateId } from "../lib/id";

export interface TimeSlotDraft {
  localId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface CourseDraft {
  localId: string;
  name: string;
  teacher: string;
  location: string;
  timeSlots: TimeSlotDraft[];
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
  }));
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
      recurrence: { type: "weekly" },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}
