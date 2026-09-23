import { DAY_OF_WEEK_LABELS } from "../../schema/course";
import type { Schedule } from "../../schema/schedule";
import type { AppSettings } from "../../schema/settings";
import { buildWeekLayout, formatMonthDay, BLOCK_COLOR_HEX } from "../scheduling/weekLayout";

const SCALE = 2;
const WIDTH = 1080;
const PADDING = 48;
const GUTTER_WIDTH = 64;
const COLUMN_GAP = 6;
const HOUR_HEIGHT = 84;
const DAY_HEADER_HEIGHT = 92;
const HEADER_HEIGHT = 108;
const FOOTER_HEIGHT = 56;

const FONT = "'PingFang TC','Microsoft JhengHei',sans-serif";

const COLORS = {
  bg: "#f7f5ee",
  ink: "#0b0b0f",
  inkFaint: "rgba(11,11,15,0.55)",
  inkFainter: "rgba(11,11,15,0.15)",
  inkFaintest: "rgba(11,11,15,0.08)",
  white: "#ffffff",
  lime: "#d7f24c",
};

/** ctx.roundRect landed in all major engines a while ago, but fall back to a square rect just in case. */
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (ctx.measureText(candidate).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? `${text.slice(0, low)}…` : "…";
}

export function renderScheduleCardCanvas(
  schedule: Schedule,
  settings: AppSettings,
  today: Date,
  weekOffset: number,
): HTMLCanvasElement {
  const layout = buildWeekLayout(schedule, settings, today, weekOffset);
  const { columns, startHour, hours, colorIndexByCourseId, rangeLabel, semesterWeekLabel } = layout;

  const contentWidth = WIDTH - PADDING * 2;
  const columnWidth = (contentWidth - GUTTER_WIDTH - COLUMN_GAP * (columns.length - 1)) / columns.length;
  const gridHeight = hours.length * HOUR_HEIGHT;
  const gridTop = PADDING + HEADER_HEIGHT + DAY_HEADER_HEIGHT;
  const height = gridTop + gridHeight + FOOTER_HEIGHT + PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("這個瀏覽器不支援產生圖片");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "top";

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  // Header
  ctx.fillStyle = COLORS.ink;
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText("課表", PADDING, PADDING);

  ctx.fillStyle = COLORS.inkFaint;
  ctx.font = `700 24px ${FONT}`;
  const subtitle = semesterWeekLabel ? `${semesterWeekLabel} · ${rangeLabel}` : rangeLabel;
  ctx.fillText(subtitle, PADDING, PADDING + 62);

  // Day headers
  const dayHeaderTop = PADDING + HEADER_HEIGHT;
  columns.forEach((column, index) => {
    const columnX = PADDING + GUTTER_WIDTH + index * (columnWidth + COLUMN_GAP);
    const centerX = columnX + columnWidth / 2;

    if (column.isToday) {
      const pillWidth = 64;
      roundedRectPath(ctx, centerX - pillWidth / 2, dayHeaderTop, pillWidth, 36, 18);
      ctx.fillStyle = COLORS.ink;
      ctx.fill();
      ctx.fillStyle = COLORS.lime;
    } else {
      ctx.fillStyle = COLORS.ink;
    }
    ctx.font = `900 20px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(DAY_OF_WEEK_LABELS[column.day], centerX, dayHeaderTop + 7);

    ctx.fillStyle = COLORS.inkFaint;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(formatMonthDay(column.date), centerX, dayHeaderTop + 44);

    if (column.holidayName) {
      const label = truncateToWidth(ctx, column.holidayName, columnWidth - 8);
      ctx.font = `900 13px ${FONT}`;
      const labelWidth = ctx.measureText(label).width + 16;
      roundedRectPath(ctx, centerX - labelWidth / 2, dayHeaderTop + 64, labelWidth, 22, 11);
      ctx.fillStyle = BLOCK_COLOR_HEX[3];
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(label, centerX, dayHeaderTop + 68);
    }
    ctx.textAlign = "left";
  });

  // Grid card background
  roundedRectPath(ctx, PADDING, gridTop, contentWidth, gridHeight, 24);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // Hour gridlines + labels
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = COLORS.inkFaint;
  hours.forEach((hour, index) => {
    const y = gridTop + index * HOUR_HEIGHT;
    if (index > 0) {
      ctx.strokeStyle = COLORS.inkFaintest;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING + GUTTER_WIDTH, y);
      ctx.lineTo(PADDING + contentWidth, y);
      ctx.stroke();
    }
    ctx.textAlign = "right";
    ctx.fillText(`${String(hour).padStart(2, "0")}:00`, PADDING + GUTTER_WIDTH - 10, y + 4);
    ctx.textAlign = "left";
  });

  // Column separators + today tint
  columns.forEach((column, index) => {
    const columnX = PADDING + GUTTER_WIDTH + index * (columnWidth + COLUMN_GAP);
    if (column.isToday) {
      ctx.fillStyle = "rgba(215,242,76,0.18)";
      ctx.fillRect(columnX, gridTop, columnWidth, gridHeight);
    }
    ctx.strokeStyle = COLORS.inkFaintest;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(columnX, gridTop);
    ctx.lineTo(columnX, gridTop + gridHeight);
    ctx.stroke();
  });

  // Course blocks
  columns.forEach((column, index) => {
    const columnX = PADDING + GUTTER_WIDTH + index * (columnWidth + COLUMN_GAP);
    for (const item of column.items) {
      const { occurrence } = item;
      const laneWidth = columnWidth / item.lanes;
      const blockX = columnX + item.lane * laneWidth + 2;
      const blockWidth = laneWidth - 4;
      const blockY = gridTop + ((item.start - startHour * 60) / 60) * HOUR_HEIGHT + 2;
      const blockHeight = Math.max(34, ((item.end - item.start) / 60) * HOUR_HEIGHT - 4);
      const cancelled = occurrence.cancelledReason !== undefined;
      const colorHex = BLOCK_COLOR_HEX[colorIndexByCourseId.get(occurrence.course.id) ?? 0];

      roundedRectPath(ctx, blockX, blockY, blockWidth, blockHeight, 10);
      ctx.fillStyle = cancelled ? "rgba(11,11,15,0.05)" : colorHex;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cancelled ? COLORS.inkFainter : COLORS.ink;
      if (cancelled) ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const textX = blockX + 8;
      const textMaxWidth = blockWidth - 16;
      ctx.fillStyle = cancelled ? COLORS.inkFaint : COLORS.ink;
      ctx.font = `900 15px ${FONT}`;
      const name = truncateToWidth(ctx, occurrence.course.name, textMaxWidth);
      ctx.fillText(name, textX, blockY + 6);

      if (blockHeight >= 56) {
        ctx.font = `700 12px ${FONT}`;
        const detail = cancelled
          ? occurrence.cancelledReason === "停課"
            ? "停課"
            : `停課・${occurrence.cancelledReason}`
          : occurrence.course.location || `${occurrence.timeSlot.startTime}–${occurrence.timeSlot.endTime}`;
        ctx.fillText(truncateToWidth(ctx, detail, textMaxWidth), textX, blockY + 28);
      }
    }
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = COLORS.inkFaint;
  ctx.fillText("課表掃描與上課提醒", WIDTH / 2, gridTop + gridHeight + 20);
  ctx.textAlign = "left";

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("圖片產生失敗"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Renders the card, then opens the native share sheet if available, otherwise downloads the PNG. */
export async function shareScheduleCard(
  schedule: Schedule,
  settings: AppSettings,
  today: Date,
  weekOffset: number,
): Promise<void> {
  const canvas = renderScheduleCardCanvas(schedule, settings, today, weekOffset);
  const blob = await canvasToBlob(canvas);
  const filename = `課表-${formatMonthDay(buildWeekLayout(schedule, settings, today, weekOffset).columns[0].date).replace("/", "-")}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "我的課表" });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Fall through to download if sharing failed for any other reason.
    }
  }
  downloadBlob(blob, filename);
}
