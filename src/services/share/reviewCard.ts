import { DAY_OF_WEEK_LABELS } from "../../schema/course";
import { accentHex } from "../../lib/theme";
import { formatDateRange } from "../../lib/formatDate";
import { formatHours, type SemesterReview } from "../scheduling/semesterReview";
import { CANVAS_FONT as FONT, canvasToBlob, roundedRectPath, shareOrDownloadImage, truncateToWidth } from "./shareImage";

/** Instagram / TikTok story size. */
const WIDTH = 1080;
const HEIGHT = 1920;
const SIDE = 72;
/** Story apps cover roughly the top and bottom 250px with their own UI; keep words out of there. */
const SAFE_TOP = 250;

const INK = "#0b0b0f";
const INK_FAINT = "rgba(11,11,15,0.6)";
const CREAM = "#f7f5ee";

/**
 * The shareable recap: only the numbers worth showing off. Attendance, absences and
 * lateness stay in the on-screen review and never go into the image.
 */
export function renderReviewCardCanvas(review: SemesterReview): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("這個瀏覽器不支援產生圖片");
  const accents = accentHex();
  ctx.textBaseline = "top";

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Decoration only, so it may sit under the story app's own buttons.
  ctx.fillStyle = accents[0];
  ctx.beginPath();
  ctx.arc(WIDTH - 40, 90, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accents[1];
  ctx.beginPath();
  ctx.arc(30, HEIGHT - 60, 260, 0, Math.PI * 2);
  ctx.fill();

  // Title
  let y = SAFE_TOP;
  ctx.font = `900 30px ${FONT}`;
  const chip = review.isFinished ? "學期回顧" : "學期回顧 · 至今";
  const chipWidth = ctx.measureText(chip).width + 48;
  roundedRectPath(ctx, SIDE, y, chipWidth, 56, 28);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = accents[0];
  ctx.fillText(chip, SIDE + 24, y + 12);

  y += 92;
  ctx.fillStyle = INK;
  ctx.font = `900 96px ${FONT}`;
  ctx.fillText("我的這學期", SIDE, y);
  y += 124;
  ctx.fillStyle = INK_FAINT;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(`${formatDateRange(review.startKey, review.endKey)} · ${review.weekCount} 週`, SIDE, y);

  // Four stat tiles
  y += 92;
  const gap = 24;
  const tileWidth = (WIDTH - SIDE * 2 - gap) / 2;
  const tileHeight = 236;
  const tiles: [string, string][] = [
    [String(review.classCount), "堂課"],
    [formatHours(review.totalMinutes), "小時"],
    [String(review.earlyCount), "個早八"],
    review.busiestDay
      ? [DAY_OF_WEEK_LABELS[review.busiestDay.day], "最滿的一天"]
      : [String(review.weekCount), "週"],
  ];
  tiles.forEach(([value, label], index) => {
    const x = SIDE + (index % 2) * (tileWidth + gap);
    const tileY = y + Math.floor(index / 2) * (tileHeight + gap);
    roundedRectPath(ctx, x, tileY, tileWidth, tileHeight, 40);
    ctx.fillStyle = accents[index % accents.length];
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `900 104px ${FONT}`;
    ctx.fillText(truncateToWidth(ctx, value, tileWidth - 64), x + 32, tileY + 34);
    ctx.font = `800 36px ${FONT}`;
    ctx.fillText(label, x + 32, tileY + 162);
  });

  // Most time spent with
  y += tileHeight * 2 + gap + 80;
  if (review.topCourses.length > 0) {
    ctx.fillStyle = INK;
    ctx.font = `900 44px ${FONT}`;
    ctx.fillText("最常見面的課", SIDE, y);
    y += 80;
    const maxMinutes = review.topCourses[0].minutes;
    const barArea = WIDTH - SIDE * 2;
    review.topCourses.forEach((course, index) => {
      const rowY = y + index * 104;
      const barWidth = Math.max(220, (course.minutes / maxMinutes) * barArea);
      roundedRectPath(ctx, SIDE, rowY, barWidth, 80, 40);
      ctx.fillStyle = accents[course.colorIndex % accents.length];
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.fillStyle = INK;
      ctx.font = `800 30px ${FONT}`;
      const hours = `${formatHours(course.minutes)} 小時`;
      const hoursWidth = ctx.measureText(hours).width;
      ctx.font = `900 34px ${FONT}`;
      const name = truncateToWidth(ctx, `${index + 1}  ${course.name}`, barArea - hoursWidth - 96);
      ctx.fillText(name, SIDE + 28, rowY + 22);
      ctx.font = `800 30px ${FONT}`;
      // Hours sit inside a long bar, or just past the end of a short one.
      const nameEnd = SIDE + 28 + ctx.measureText(name).width + 24;
      const hoursX = Math.max(nameEnd, SIDE + barWidth - hoursWidth - 28);
      ctx.fillText(hours, hoursX, rowY + 25);
    });
  }

  ctx.fillStyle = INK_FAINT;
  ctx.font = `700 28px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("課表掃描與上課提醒", WIDTH / 2, HEIGHT - 300);
  ctx.textAlign = "left";

  return canvas;
}

export function renderReviewCardBlob(review: SemesterReview): Promise<Blob> {
  return canvasToBlob(renderReviewCardCanvas(review));
}

export function shareReviewCard(blob: Blob, review: SemesterReview): Promise<void> {
  return shareOrDownloadImage(blob, `學期回顧-${review.endKey}.png`, "我的學期回顧");
}
