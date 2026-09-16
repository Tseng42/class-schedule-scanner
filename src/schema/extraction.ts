import { z } from "zod";
import { dayOfWeekSchema } from "./course";

/**
 * Narrower than `Course` — this is what we ask Claude to produce.
 * The model can't know `id`, `createdAt`, or semester bounds, so those
 * are filled in by `mapExtraction.ts` after this comes back.
 */
export const extractedTimeSlotSchema = z.object({
  dayOfWeek: dayOfWeekSchema.describe("課程當天是星期幾,用兩碼代碼"),
  startTime: z.string().describe("24小時制開始時間,格式 HH:mm,例如 09:10"),
  endTime: z.string().describe("24小時制結束時間,格式 HH:mm,例如 12:00"),
});
export type ExtractedTimeSlot = z.infer<typeof extractedTimeSlotSchema>;

export const extractedCourseSchema = z.object({
  name: z.string().describe("課程名稱"),
  teacher: z.string().optional().describe("授課教師姓名,看不清楚或沒寫就留空"),
  location: z.string().optional().describe("上課地點/教室,看不清楚或沒寫就留空"),
  timeSlots: z
    .array(extractedTimeSlotSchema)
    .describe("這堂課每週上課的時段,同一堂課可能在不同天各有一個時段"),
});
export type ExtractedCourse = z.infer<typeof extractedCourseSchema>;

export const extractionResultSchema = z.object({
  courses: z.array(extractedCourseSchema),
  warnings: z
    .array(z.string())
    .optional()
    .describe(
      "辨識時不確定的地方,例如某一列時間模糊用猜的、圖片不是課表等。沒有疑慮就省略這個欄位。",
    ),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
