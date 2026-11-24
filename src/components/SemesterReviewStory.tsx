import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DAY_OF_WEEK_LABELS } from "../schema/course";
import { formatDateRange } from "../lib/formatDate";
import { formatHours, type SemesterReview } from "../services/scheduling/semesterReview";
import { BLOCK_COLORS } from "../services/scheduling/weekLayout";
import { renderReviewCardBlob, shareReviewCard } from "../services/share/reviewCard";

interface SemesterReviewStoryProps {
  review: SemesterReview;
  onClose: () => void;
}

interface Slide {
  key: string;
  content: ReactNode;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up to `value`; screen readers only hear the final number. */
function CountUp({ value }: { value: number }) {
  const [reduced] = useState(prefersReducedMotion);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      // The first frame's timestamp can predate `start`, so clamp at 0 too.
      const progress = Math.min(1, Math.max(0, (time - start) / 900));
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {reduced ? value : shown}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}

const kickerClass = "text-lg font-black";
/** Scales with the screen so a six-character line like 你的學期回顧 stays on one line down to 320px. */
const bigClass = "mt-2 text-[clamp(2.5rem,13vw,4.5rem)] leading-none font-black tracking-tight";
const subClass = "mt-5 text-lg font-bold";

function buildSlides(review: SemesterReview): Slide[] {
  const slides: Slide[] = [];
  const range = `${formatDateRange(review.startKey, review.endKey)} · ${review.weekCount} 週`;

  slides.push({
    key: "intro",
    content: (
      <>
        <p className={kickerClass}>{range}</p>
        <p className={bigClass}>你的學期回顧</p>
        <p className={subClass}>{review.isFinished ? "這學期辛苦了,一起來看看。" : "學期還沒結束,先看看到目前為止。"}</p>
        <p className="mt-10 text-sm font-bold opacity-70">點右邊看下一張,點左邊回上一張</p>
      </>
    ),
  });

  const movies = Math.floor(review.totalMinutes / 120);
  slides.push({
    key: "classes",
    content: (
      <>
        <p className={kickerClass}>這學期你上了</p>
        <p className={bigClass}>
          <CountUp value={review.classCount} /> 堂課
        </p>
        <p className={subClass}>
          加起來 {formatHours(review.totalMinutes)} 小時
          {movies >= 2 ? `,差不多是 ${movies} 部電影的長度` : ""}
        </p>
      </>
    ),
  });

  slides.push({
    key: "early",
    content:
      review.earlyCount > 0 ? (
        <>
          <p className={kickerClass}>你撐過了</p>
          <p className={bigClass}>
            <CountUp value={review.earlyCount} /> 個早八
          </p>
          <p className={subClass}>每一個都算數。</p>
        </>
      ) : (
        <>
          <p className={kickerClass}>這學期</p>
          <p className={bigClass}>0 個早八</p>
          <p className={subClass}>沒有早八,好命!</p>
        </>
      ),
  });

  if (review.topCourses.length > 0) {
    const maxMinutes = review.topCourses[0].minutes;
    slides.push({
      key: "top",
      content: (
        <>
          <p className={kickerClass}>最常見面的課</p>
          <ol className="mt-6 flex flex-col gap-3">
            {review.topCourses.map((course, index) => (
              <li key={course.courseId}>
                <div
                  className={`review-bar flex min-w-fit items-center justify-between gap-3 rounded-full border-2 border-ink px-4 py-3 ${
                    BLOCK_COLORS[course.colorIndex]
                  }`}
                  style={{ width: `${Math.max(45, (course.minutes / maxMinutes) * 100)}%`, animationDelay: `${index * 140}ms` }}
                >
                  <span className="truncate text-lg font-black">
                    {index + 1}. {course.name}
                  </span>
                  <span className="shrink-0 text-sm font-black">{formatHours(course.minutes)} 小時</span>
                </div>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  if (review.busiestDay) {
    slides.push({
      key: "busiest",
      content: (
        <>
          <p className={kickerClass}>每週最滿的一天</p>
          <p className={bigClass}>{DAY_OF_WEEK_LABELS[review.busiestDay.day]}</p>
          <p className={subClass}>一天有 {formatHours(review.busiestDay.minutes)} 小時的課。</p>
        </>
      ),
    });
  }

  if (review.holidayDays > 0 || review.skippedClasses > 0) {
    slides.push({
      key: "breaks",
      content:
        review.holidayDays > 0 ? (
          <>
            <p className={kickerClass}>這學期放了</p>
            <p className={bigClass}>
              <CountUp value={review.holidayDays} /> 天假
            </p>
            {review.skippedClasses > 0 && <p className={subClass}>放假加停課,少上了 {review.skippedClasses} 堂課。</p>}
          </>
        ) : (
          <>
            <p className={kickerClass}>這學期有</p>
            <p className={bigClass}>
              <CountUp value={review.skippedClasses} /> 堂課停課
            </p>
          </>
        ),
    });
  }

  if (review.examCount > 0 || review.assignmentCount > 0) {
    slides.push({
      key: "events",
      content: (
        <>
          <p className={kickerClass}>這學期有</p>
          {review.examCount > 0 && (
            <p className={bigClass}>
              <CountUp value={review.examCount} /> 次考試
            </p>
          )}
          {review.assignmentCount > 0 && (
            <p className={`${bigClass} ${review.examCount > 0 ? "mt-4" : ""}`}>
              {/* Once anything has been checked off, count what got done rather than what was assigned. */}
              <CountUp value={review.assignmentDoneCount > 0 ? review.assignmentDoneCount : review.assignmentCount} /> 份作業
              {review.assignmentDoneCount > 0 ? "完成" : ""}
            </p>
          )}
          <p className={subClass}>都撐過來了。</p>
        </>
      ),
    });
  }

  if (review.focusMinutes > 0) {
    const hours = review.focusMinutes / 60;
    slides.push({
      key: "focus",
      content: (
        <>
          <p className={kickerClass}>這學期你專注了</p>
          <p className={bigClass}>
            {review.focusMinutes < 60 ? (
              <>
                <CountUp value={review.focusMinutes} /> 分鐘
              </>
            ) : hours >= 10 ? (
              <>
                <CountUp value={Math.round(hours)} /> 小時
              </>
            ) : (
              `${formatHours(review.focusMinutes)} 小時`
            )}
          </p>
          <p className={subClass}>
            {review.topFocusCourse ? `花最多時間的是${review.topFocusCourse}。` : "每一分鐘都算數。"}
          </p>
        </>
      ),
    });
  }

  if (review.attendance) {
    const { attendedRate, lateCount, perfectCourses, marked } = review.attendance;
    const shownPerfect = perfectCourses.slice(0, 3).join("、");
    slides.push({
      key: "attendance",
      content: (
        <>
          <p className="w-fit rounded-full bg-ink px-3 py-1 text-xs font-black text-white">只有你看得到,不會放進分享圖</p>
          <p className={`${kickerClass} mt-4`}>出席率</p>
          <p className={bigClass}>
            <CountUp value={Math.round(attendedRate * 100)} />%
          </p>
          <p className={subClass}>
            {perfectCourses.length > 0
              ? `全勤的課:${shownPerfect}${perfectCourses.length > 3 ? ` 等 ${perfectCourses.length} 門` : ""}`
              : `依你記的 ${marked} 堂課計算`}
          </p>
          {lateCount > 0 && <p className="mt-2 text-lg font-bold">遲到 {lateCount} 次</p>}
          <p className="mt-6 text-sm font-bold opacity-70">公假和遲到算有到,沒記的課不算。</p>
        </>
      ),
    });
  }

  return slides;
}

/** The final slide: a preview of the story-sized image and the share button. */
function ShareSlide({ review, onRestart, onClose }: { review: SemesterReview; onRestart: () => void; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    renderReviewCardBlob(review).then(
      (made) => {
        if (cancelled) return;
        url = URL.createObjectURL(made);
        setBlob(made);
        setPreviewUrl(url);
      },
      () => {
        if (!cancelled) setError("圖片產生失敗");
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [review]);

  const handleShare = async () => {
    if (!blob) return;
    setError(null);
    try {
      await shareReviewCard(blob, review);
    } catch {
      setError("分享失敗,再試一次");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className={kickerClass}>存成圖片,分享到限動</p>
      <div className="aspect-[9/16] h-[min(52vh,26rem)] overflow-hidden rounded-2xl border-2 border-ink bg-white">
        {previewUrl && <img src={previewUrl} alt="學期回顧分享圖預覽" className="size-full object-cover" />}
      </div>
      <p className="text-xs font-bold opacity-70">分享圖只有上課的數字,不含出缺席。</p>
      {error && <p className="card-error text-sm font-bold">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={!blob}
          onClick={() => void handleShare()}
          className="rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          {blob ? "分享圖片" : "產生中…"}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border-2 border-ink px-5 py-3 text-sm font-black transition-transform active:scale-95"
        >
          從頭再看
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border-2 border-ink px-5 py-3 text-sm font-black transition-transform active:scale-95"
        >
          完成
        </button>
      </div>
    </div>
  );
}

/** Story-style semester recap: one big number per screen, tap right for next and left for back. */
export function SemesterReviewStory({ review, onClose }: SemesterReviewStoryProps) {
  const [slides] = useState(() => buildSlides(review));
  const [index, setIndex] = useState(0);
  const total = slides.length + 1;
  const isLast = index === total - 1;
  const nextRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const go = (delta: number) => setIndex((current) => Math.min(total - 1, Math.max(0, current + delta)));

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nextRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      else if (event.key === "ArrowRight") setIndex((current) => Math.min(total - 1, current + 1));
      else if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [total]);

  // Keyboard users land on the share slide's buttons once the tap zone for "next" is gone.
  useEffect(() => {
    if (isLast) dialogRef.current?.querySelector<HTMLButtonElement>("[data-review-content] button:not(:disabled)")?.focus();
  }, [isLast]);

  const background = isLast ? "bg-cream" : BLOCK_COLORS[index % BLOCK_COLORS.length];

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="學期回顧"
      data-expand-target
      data-swipe-ignore
      className={`fixed inset-0 z-[60] flex flex-col overscroll-none ${background} text-ink transition-colors duration-300`}
    >
      <div className="relative z-20 flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/20">
              <div className={`h-full rounded-full bg-ink ${i <= index ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉學期回顧"
          className="-mr-2 grid size-11 place-items-center rounded-full text-2xl leading-none font-black"
        >
          ×
        </button>
      </div>

      <div className="relative flex-1">
        <button
          type="button"
          aria-label="上一張"
          disabled={index === 0}
          onClick={() => go(-1)}
          className="absolute inset-y-0 left-0 w-1/3 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink"
        />
        {!isLast && (
          <button
            ref={nextRef}
            type="button"
            aria-label="下一張"
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 w-2/3 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink"
          />
        )}
        <div
          data-review-content
          aria-live="polite"
          className={`relative mx-auto flex h-full max-w-md flex-col justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] ${
            isLast ? "" : "pointer-events-none"
          }`}
        >
          <p className="sr-only">
            第 {index + 1} 張,共 {total} 張
          </p>
          <div key={index} className="review-enter">
            {isLast ? (
              <ShareSlide review={review} onRestart={() => setIndex(0)} onClose={onClose} />
            ) : (
              slides[index].content
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
