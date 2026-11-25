import { DAY_OF_WEEK_LABELS } from "../../schema/course";
import type { Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { accentHex } from "../../lib/theme";
import { parseDateKey } from "../scheduling/dateKey";
import type { CourseOccurrence } from "../scheduling/nextClass";
import { BLOCK_COLORS, DAY_ORDER, layoutDay, toMinutes } from "../scheduling/weekLayout";
import { CANVAS_FONT as FONT, canvasToBlob, roundedRectPath, shareOrDownloadImage, truncateToWidth } from "./shareImage";

/*
 * 課表桌布: the ordinary week (weekly courses only, no holidays or one-off classes) drawn at
 * this phone's screen size, with the top left clear for the lock-screen clock and widgets and
 * the bottom clear for the flashlight and camera buttons.
 */

export type WallpaperStyle = "light" | "dark";

/** iPhone 16's screen, for when this device's can't be read or isn't a phone held upright. */
const FALLBACK_SIZE = { width: 1179, height: 2556 };
/** Everything is laid out on a 390-wide grid (an iPhone's width in points) and scaled up. */
const LOGICAL_WIDTH = 390;
/** Share of the height kept clear at the top (clock, date, widgets) and at the bottom (buttons, home bar). */
const TOP_CLEAR = 0.32;
const BOTTOM_CLEAR = 0.12;
const SIDE = 14;
const GUTTER = 30;
const GAP = 3;
const TITLE_HEIGHT = 24;
const DAY_HEADER_HEIGHT = 24;

const PALETTES = {
  light: {
    bg: "#f7f5ee",
    grid: "#ffffff",
    ink: "#0b0b0f",
    faint: "rgba(11,11,15,0.55)",
    line: "rgba(11,11,15,0.08)",
    border: "#0b0b0f",
  },
  dark: {
    bg: "#0b0b0f",
    grid: "#17171c",
    ink: "#ffffff",
    faint: "rgba(255,255,255,0.6)",
    line: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.25)",
  },
};
const BLOCK_TEXT = "#0b0b0f";
/** Text sizes in points: big enough to read at a glance on a lock screen. */
const NAME_SIZE = 12;
const DETAIL_SIZE = 9.5;
const NAME_MIN_SIZE = 10;

/** The longest start of `text` that fits `maxWidth`, and what's left over. */
function splitToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): [string, string] {
  let end = text.length;
  while (end > 1 && ctx.measureText(text.slice(0, end)).width > maxWidth) end -= 1;
  return [text.slice(0, end), text.slice(end)];
}

/** This phone's screen in device pixels, held upright. */
export function wallpaperSize(): { width: number; height: number } {
  try {
    const ratio = window.devicePixelRatio || 1;
    const short = Math.min(window.screen.width, window.screen.height);
    const long = Math.max(window.screen.width, window.screen.height);
    const width = Math.round(short * ratio);
    const height = Math.round(long * ratio);
    // A phone is narrow and tall; a computer screen or a tablet gets the fallback.
    if (short <= 500 && long / short >= 1.7 && width >= 640) return { width, height };
  } catch {
    // Falls through to the fallback.
  }
  return FALLBACK_SIZE;
}

/** "115 學年度第 1 學期" from the semester's start date, or null when it isn't set. */
export function semesterLabel(settings: AppSettings): string | null {
  if (!settings.semesterStartDate) return null;
  const start = parseDateKey(settings.semesterStartDate);
  const month = start.getMonth() + 1;
  const year = start.getFullYear() - 1911 - (month >= 8 ? 0 : 1);
  return `${year} 學年度第 ${month >= 8 ? 1 : 2} 學期`;
}

/** Every weekly class slot, shaped like a day's occurrences so the timetable's lane layout can be reused. */
function weeklySlots(schedule: Schedule) {
  const courses = schedule.courses.filter((course) => course.recurrence.type === "weekly");
  const byDay = new Map<string, CourseOccurrence[]>();
  for (const course of courses) {
    for (const timeSlot of course.timeSlots) {
      const list = byDay.get(timeSlot.dayOfWeek) ?? [];
      list.push({ course, timeSlot, dateKey: "", startAt: new Date(0), endAt: new Date(0) });
      byDay.set(timeSlot.dayOfWeek, list);
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime));
  return { courses, byDay };
}

/** Whether there's anything to draw: at least one class that meets every week. */
export function hasWeeklyClasses(schedule: Schedule): boolean {
  return schedule.courses.some((course) => course.recurrence.type === "weekly");
}

export function renderWallpaperCanvas(
  schedule: Schedule,
  settings: AppSettings,
  style: WallpaperStyle,
  size = wallpaperSize(),
): HTMLCanvasElement {
  const colors = PALETTES[style];
  const scale = size.width / LOGICAL_WIDTH;
  const height = size.height / scale;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("這個瀏覽器不支援產生圖片");
  ctx.scale(scale, scale);
  ctx.textBaseline = "top";

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, height);

  const { courses, byDay } = weeklySlots(schedule);
  if (courses.length === 0) return canvas;

  const slots = courses.flatMap((course) => course.timeSlots);
  const showWeekend = slots.some((slot) => slot.dayOfWeek === "SA" || slot.dayOfWeek === "SU");
  const days = DAY_ORDER.slice(0, showWeekend ? 7 : 5);
  const startHour = Math.floor(Math.min(...slots.map((slot) => toMinutes(slot.startTime))) / 60);
  const endHour = Math.max(Math.ceil(Math.max(...slots.map((slot) => toMinutes(slot.endTime))) / 60), startHour + 4);
  const hourCount = endHour - startHour;
  const accents = accentHex();
  const colorIndex = new Map(schedule.courses.map((course, index) => [course.id, index % BLOCK_COLORS.length]));

  const top = height * TOP_CLEAR;
  const bottom = height * (1 - BOTTOM_CLEAR);
  const gridTop = top + TITLE_HEIGHT + DAY_HEADER_HEIGHT;
  const gridHeight = bottom - gridTop;
  const hourHeight = gridHeight / hourCount;
  const gridLeft = SIDE + GUTTER;
  const gridWidth = LOGICAL_WIDTH - SIDE - gridLeft;
  const columnWidth = (gridWidth - GAP * (days.length - 1)) / days.length;
  const columnX = (index: number) => gridLeft + index * (columnWidth + GAP);

  // Semester line
  const label = semesterLabel(settings);
  if (label) {
    ctx.fillStyle = colors.faint;
    ctx.font = `800 12px ${FONT}`;
    ctx.fillText(label, SIDE, top);
  }

  // Day headers
  ctx.textAlign = "center";
  ctx.fillStyle = colors.ink;
  ctx.font = `900 13px ${FONT}`;
  days.forEach((day, index) => {
    ctx.fillText(DAY_OF_WEEK_LABELS[day], columnX(index) + columnWidth / 2, top + TITLE_HEIGHT + 4);
  });
  ctx.textAlign = "left";

  // Grid card
  roundedRectPath(ctx, SIDE, gridTop, LOGICAL_WIDTH - SIDE * 2, gridHeight, 14);
  ctx.fillStyle = colors.grid;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  // Hour lines and labels
  ctx.font = `700 10px ${FONT}`;
  for (let index = 0; index < hourCount; index += 1) {
    const y = gridTop + index * hourHeight;
    if (index > 0) {
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(gridLeft, y);
      ctx.lineTo(LOGICAL_WIDTH - SIDE, y);
      ctx.stroke();
    }
    ctx.fillStyle = colors.faint;
    ctx.textAlign = "right";
    ctx.fillText(String(startHour + index), gridLeft - 6, y + 3);
    ctx.textAlign = "left";
  }

  // Course blocks: name, then room and time as the block's height allows.
  days.forEach((day, index) => {
    for (const item of layoutDay(byDay.get(day) ?? [])) {
      const { course, timeSlot } = item.occurrence;
      const laneWidth = columnWidth / item.lanes;
      const x = columnX(index) + item.lane * laneWidth + 1;
      const width = laneWidth - 2;
      const y = gridTop + ((item.start - startHour * 60) / 60) * hourHeight + 1;
      const blockHeight = Math.max(18, ((item.end - item.start) / 60) * hourHeight - 2);

      roundedRectPath(ctx, x, y, width, blockHeight, 6);
      ctx.fillStyle = accents[colorIndex.get(course.id) ?? 0];
      ctx.fill();

      const textX = x + 4;
      const maxWidth = width - 7;
      ctx.fillStyle = BLOCK_TEXT;
      let lineY = y + 4;
      const fits = (lineHeight: number) => lineY + lineHeight <= y + blockHeight - 2;
      const line = (text: string, font: string, lineHeight: number) => {
        if (!fits(lineHeight)) return;
        ctx.font = font;
        ctx.fillText(truncateToWidth(ctx, text, maxWidth), textX, lineY);
        lineY += lineHeight;
      };
      // A name a little too long is set smaller to stay on one line; a long one takes two.
      let nameSize = NAME_SIZE;
      ctx.font = `900 ${nameSize}px ${FONT}`;
      while (nameSize > NAME_MIN_SIZE && ctx.measureText(course.name).width > maxWidth) {
        nameSize -= 0.5;
        ctx.font = `900 ${nameSize}px ${FONT}`;
      }
      if (ctx.measureText(course.name).width > maxWidth) nameSize = NAME_SIZE;
      const nameFont = `900 ${nameSize}px ${FONT}`;
      ctx.font = nameFont;
      const [first, rest] = splitToWidth(ctx, course.name, maxWidth);
      line(first, nameFont, nameSize + 3);
      if (rest && fits(nameSize + 3) && lineY + nameSize + 3 + DETAIL_SIZE + 2 <= y + blockHeight) {
        line(rest, nameFont, nameSize + 3);
      }
      lineY += 1;
      const detailFont = `700 ${DETAIL_SIZE}px ${FONT}`;
      const smallFont = `700 ${DETAIL_SIZE - 1}px ${FONT}`;
      if (course.location) line(course.location, detailFont, DETAIL_SIZE + 2);
      const time = `${timeSlot.startTime}–${timeSlot.endTime}`;
      ctx.font = detailFont;
      const timeFits = ctx.measureText(time).width <= maxWidth;
      ctx.font = smallFont;
      if (timeFits) line(time, detailFont, DETAIL_SIZE + 2);
      else if (ctx.measureText(time).width <= maxWidth) line(time, smallFont, DETAIL_SIZE + 1);
      else {
        line(timeSlot.startTime, detailFont, DETAIL_SIZE + 2);
        line(`–${timeSlot.endTime}`, detailFont, DETAIL_SIZE + 2);
      }
    }
  });

  return canvas;
}

/** Renders the wallpaper, then opens the share sheet (where 儲存影像 lives) or downloads it. */
export async function shareWallpaper(schedule: Schedule, settings: AppSettings, style: WallpaperStyle): Promise<void> {
  const blob = await canvasToBlob(renderWallpaperCanvas(schedule, settings, style));
  await shareOrDownloadImage(blob, `課表桌布-${style === "dark" ? "深色" : "淺色"}.png`, "課表桌布");
}
