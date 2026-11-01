import type { AppSettings } from "../schema/settings";
import { formatDateRange } from "./formatDate";

export type ReminderUnit = "minutes" | "hours" | "days";

export const UNIT_TO_MINUTES: Record<ReminderUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export const UNIT_LABELS: Record<ReminderUnit, string> = {
  minutes: "分鐘前",
  hours: "小時前",
  days: "天前",
};

export function deriveUnitAndValue(totalMinutes: number): { unit: ReminderUnit; value: string } {
  if (totalMinutes % 1440 === 0 && totalMinutes >= 1440) {
    return { unit: "days", value: String(totalMinutes / 1440) };
  }
  if (totalMinutes % 60 === 0 && totalMinutes >= 60) {
    return { unit: "hours", value: String(totalMinutes / 60) };
  }
  return { unit: "minutes", value: String(totalMinutes) };
}

/** "10 分鐘前", as shown on the settings list. */
export function formatReminderLead(totalMinutes: number): string {
  const { unit, value } = deriveUnitAndValue(totalMinutes);
  return `${value} ${UNIT_LABELS[unit]}`;
}

/** The semester as shown on the settings list. */
export function formatSemesterRange({ semesterStartDate, semesterEndDate }: AppSettings): string {
  if (semesterStartDate && semesterEndDate) return formatDateRange(semesterStartDate, semesterEndDate);
  if (semesterStartDate) return `${formatDateRange(semesterStartDate, semesterStartDate)} 起`;
  if (semesterEndDate) return `到 ${formatDateRange(semesterEndDate, semesterEndDate)}`;
  return "未設定";
}

export type NotificationState = "unsupported" | NotificationPermission;

export function currentNotificationState(): NotificationState {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** The permission state as shown on the settings list. */
export function notificationStatusLabel(): string {
  const state = currentNotificationState();
  if (state === "unsupported") return "不支援";
  if (state === "granted") return "已開啟";
  if (state === "denied") return "已封鎖";
  return "尚未開啟";
}
