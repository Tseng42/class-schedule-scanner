import { useEffect, useMemo, useState } from "react";
import { loadSchedule, setAttendance, updateCourseEvent } from "../services/storage/scheduleRepository";
import { loadSettings, saveSettings } from "../services/storage/settingsRepository";
import { useNow } from "../hooks/useNow";
import { useClassReminders } from "../hooks/useClassReminders";
import { useFocusTimer } from "../hooks/useFocusTimer";
import { AttendancePrompt } from "../components/AttendancePrompt";
import { ClassProgressRing } from "../components/ClassProgressRing";
import { SemesterReviewStory } from "../components/SemesterReviewStory";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { ExamCountdown } from "../components/ExamCountdown";
import { ExamPrepSheet } from "../components/ExamPrepSheet";
import { FocusCard } from "../components/FocusCard";
import { FocusSetupSheet } from "../components/FocusSetupSheet";
import { FocusTimerOverlay } from "../components/FocusTimerOverlay";
import { WeeklyTimetable } from "../components/WeeklyTimetable";
import { burstConfetti } from "../lib/confetti";
import { formatDateRange } from "../lib/formatDate";
import type { Course, PrepItem } from "../schema/course";
import type { AttendanceStatus, Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { getExamCountdown, getHomeEvents, type ScheduledEvent } from "../services/scheduling/events";
import { toDateKey } from "../services/scheduling/dateKey";
import {
  findCurrentOccurrence,
  formatCountdown,
  formatDuration,
  formatOccurrenceDay,
  getNextOccurrence,
  getOccurrencesForDate,
  type CourseOccurrence,
} from "../services/scheduling/nextClass";
import { getHolidayCountdown, getSemesterStatus } from "../services/scheduling/semester";
import {
  attendanceKey,
  listCoursesNearLimit,
  listUnmarkedClasses,
  trackingStartKey,
} from "../services/scheduling/attendance";
import { buildSemesterReview, isReviewSeason, type SemesterReview } from "../services/scheduling/semesterReview";
import {
  focusLengthsFrom,
  focusSessionsBetween,
  sumMinutes,
  type FocusLengths,
} from "../services/focus/focusTimer";

/** The last stretch of a class, when the countdown ticks every second. */
const FINAL_COUNTDOWN_MS = 5 * 60 * 1000;
/** How long "下課啦！" stays up after a class ends. */
const CLASS_END_CELEBRATION_MS = 60 * 1000;

/** Holds the semester end date whose "回顧出爐了" card was dismissed, so it stays gone until the next semester. */
const REVIEW_NUDGE_DISMISSED_KEY = "class-schedule-scanner:review-nudge-dismissed";

function readDismissedNudge(): string | null {
  try {
    return localStorage.getItem(REVIEW_NUDGE_DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Classes whose end has already been celebrated, so returning to this page doesn't fire the confetti again. */
const celebratedClasses = new Set<string>();

function occurrenceKey(occurrence: CourseOccurrence): string {
  return `${occurrence.dateKey}|${occurrence.course.id}|${occurrence.timeSlot.id}`;
}

/** The latest class that ended less than CLASS_END_CELEBRATION_MS ago. */
function findJustEnded(occurrences: CourseOccurrence[], now: Date): CourseOccurrence | undefined {
  return [...occurrences]
    .reverse()
    .find((occurrence) => now >= occurrence.endAt && now.getTime() - occurrence.endAt.getTime() < CLASS_END_CELEBRATION_MS);
}

/** When the home screen next needs to redraw: a class starting or ending, or the next second of a countdown. */
function nextScreenChange(schedule: Schedule, settings: AppSettings, at: Date): Date | null {
  const occurrences = getOccurrencesForDate(schedule, at, settings);
  const running = findCurrentOccurrence(occurrences, at);
  if (running) {
    const msLeft = running.endAt.getTime() - at.getTime();
    if (msLeft > FINAL_COUNTDOWN_MS) return new Date(running.endAt.getTime() - FINAL_COUNTDOWN_MS);
    return new Date(at.getTime() + (msLeft % 1000 || 1000));
  }
  const candidates: number[] = [];
  const ended = findJustEnded(occurrences, at);
  if (ended) candidates.push(ended.endAt.getTime() + CLASS_END_CELEBRATION_MS);
  const upcoming = getNextOccurrence(schedule, at, settings);
  if (upcoming) candidates.push(upcoming.startAt.getTime());
  return candidates.length > 0 ? new Date(Math.min(...candidates)) : null;
}

interface HomePageProps {
  onNavigateUpload: () => void;
  onAddCourse: () => void;
}

/** Undated notes are general reminders (always shown); dated ones only surface on their matching class day. */
function relevantNotes(course: Course, at: Date): string[] {
  const dateKey = toDateKey(at);
  return (course.notes ?? [])
    .filter((note) => !note.date || note.date === dateKey)
    .map((note) => note.text);
}

function isNotificationGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function HomePage({ onNavigateUpload, onAddCourse }: HomePageProps) {
  const [schedule, setSchedule] = useState(() => loadSchedule());
  const [settings] = useState(() => loadSettings());
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  /** To-dos checked during this visit stay in the list, struck through, so a mis-tap is easy to undo. */
  const [checkedThisVisit, setCheckedThisVisit] = useState<ReadonlySet<string>>(() => new Set());
  /** The exam whose 複習清單 is open, looked up fresh from `schedule` so edits show at once. */
  const [prepFor, setPrepFor] = useState<{ courseId: string; eventId: string } | null>(null);
  const [openReview, setOpenReview] = useState<SemesterReview | null>(null);
  const [dismissedNudge, setDismissedNudge] = useState(readDismissedNudge);
  const [focusSetupLengths, setFocusSetupLengths] = useState<FocusLengths | null>(null);
  const [focusScreenOpen, setFocusScreenOpen] = useState(false);
  const focus = useFocusTimer(setSchedule);
  const now = useNow((at) => nextScreenChange(schedule, settings, at));

  useClassReminders(schedule, settings, isNotificationGranted());

  const todayOccurrences = getOccurrencesForDate(schedule, now, settings);
  const current = findCurrentOccurrence(todayOccurrences, now);
  const justEnded = current ? undefined : findJustEnded(todayOccurrences, now);
  const justEndedKey = justEnded ? occurrenceKey(justEnded) : null;

  useEffect(() => {
    if (!justEndedKey || celebratedClasses.has(justEndedKey)) return;
    celebratedClasses.add(justEndedKey);
    burstConfetti();
  }, [justEndedKey]);

  // Scanning the whole semester is cheap but not free, and `now` ticks every second near the end of a class.
  const minute = Math.floor(now.getTime() / 60000);
  const unmarked = useMemo(
    () => listUnmarkedClasses(schedule, settings, new Date(minute * 60000)),
    [schedule, settings, minute],
  );
  const dateKey = toDateKey(now);
  const nearLimit = useMemo(
    () => listCoursesNearLimit(schedule, settings, new Date(`${dateKey}T12:00:00`)),
    [schedule, settings, dateKey],
  );

  const review = useMemo(
    () => buildSemesterReview(schedule, settings, new Date(minute * 60000)),
    [schedule, settings, minute],
  );
  const hasReview = review !== null && review.classCount > 0;

  // The open review is a history entry, so Android back and swipe-back close it
  // instead of leaving the app.
  const showReview = () => {
    if (!review) return;
    window.history.pushState(null, "");
    setOpenReview(review);
  };
  const closeReview = () => window.history.back();

  useEffect(() => {
    if (!openReview) return;
    const handlePopState = () => setOpenReview(null);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [openReview]);

  // The full-screen timer is a history entry too: back hides it and the timer keeps going.
  const openFocusScreen = () => {
    window.history.pushState(null, "");
    setFocusScreenOpen(true);
  };
  const minimizeFocusScreen = () => window.history.back();

  useEffect(() => {
    if (!focusScreenOpen) return;
    const handlePopState = () => setFocusScreenOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [focusScreenOpen]);

  // The run ended (here, in another tab, or left too long): drop the screen's history entry with it.
  useEffect(() => {
    if (focusScreenOpen && !focus.run) window.history.back();
  }, [focusScreenOpen, focus.run]);

  const handleFocusStart = (lengths: FocusLengths, courseId: string | undefined) => {
    setFocusSetupLengths(null);
    const saved = loadSettings();
    const before = focusLengthsFrom(saved);
    if (
      before.focusMinutes !== lengths.focusMinutes ||
      before.breakMinutes !== lengths.breakMinutes ||
      before.longBreakMinutes !== lengths.longBreakMinutes
    ) {
      try {
        saveSettings({ ...saved, ...lengths });
      } catch {
        // Only means next time starts from the old lengths.
      }
    }
    focus.start(lengths, courseId);
    openFocusScreen();
  };

  const dismissNudge = () => {
    const end = settings.semesterEndDate ?? "";
    setDismissedNudge(end);
    try {
      localStorage.setItem(REVIEW_NUDGE_DISMISSED_KEY, end);
    } catch {
      // Only means the card comes back next visit.
    }
  };

  const handleToggleDone = (item: ScheduledEvent) => {
    const done = !item.event.done;
    try {
      setSchedule(updateCourseEvent(item.course.id, item.event.id, { done }));
      setCheckedThisVisit((current) => new Set(current).add(item.event.id));
      setEventError(null);
    } catch (error) {
      setEventError(error instanceof Error ? error.message : "儲存失敗");
    }
  };

  const handlePrepChange = (courseId: string, eventId: string, checklist: PrepItem[]) => {
    try {
      setSchedule(updateCourseEvent(courseId, eventId, { checklist }));
      setEventError(null);
    } catch (error) {
      setEventError(error instanceof Error ? error.message : "儲存失敗");
    }
  };

  const handleMark = (occurrence: CourseOccurrence, status: AttendanceStatus) => {
    try {
      setSchedule(setAttendance(attendanceKey(occurrence), status));
      setAttendanceError(null);
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "儲存失敗");
    }
  };

  if (schedule.courses.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <p className="text-2xl font-black text-ink dark:text-white">還沒有課表資料</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onAddCourse}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            + 新增課程
          </button>
          <button
            type="button"
            onClick={onNavigateUpload}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            掃描第一張課表
          </button>
        </div>
      </main>
    );
  }

  const next = getNextOccurrence(schedule, now, settings);
  const todayLabel = now.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  const examCountdown = getExamCountdown(schedule, now);
  const prepCourse = prepFor ? schedule.courses.find((course) => course.id === prepFor.courseId) : undefined;
  const prepExam = prepCourse?.events?.find((event) => event.id === prepFor?.eventId);
  const homeEvents = getHomeEvents(schedule, now, trackingStartKey(schedule, settings), checkedThisVisit);
  const semester = getSemesterStatus(settings, now);
  const holiday = getHolidayCountdown(schedule, now);
  const msUntilEnd = current ? current.endAt.getTime() - now.getTime() : 0;
  const todayFocusMinutes = sumMinutes(focusSessionsBetween(schedule, dateKey, dateKey));
  const focusCourseName = focus.run?.courseId
    ? (schedule.courses.find((course) => course.id === focus.run?.courseId)?.name ?? null)
    : null;

  const showNudge = hasReview && isReviewSeason(settings, now) && dismissedNudge !== settings.semesterEndDate;
  const showReviewCard = hasReview && semester?.kind !== "during";

  const stripCardClass =
    "min-w-0 flex-1 rounded-2xl border-2 border-ink/10 bg-white p-3.5 text-ink dark:border-white/10 dark:bg-white/5 dark:text-white";
  const stripLabelClass = "text-xs font-black text-ink/60 dark:text-white/60";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">課表</h1>
        <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">{todayLabel}</p>
      </header>

      {showNudge && review && (
        <section className="flex items-center gap-2 rounded-3xl bg-sky py-3 pr-2 pl-4 text-ink">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black">{review.isFinished ? "學期回顧出爐了" : "學期快結束了,回顧出爐了"}</h2>
            <p className="mt-0.5 text-xs font-bold">上了幾堂課、撐過幾個早八</p>
          </div>
          <button
            type="button"
            onClick={showReview}
            className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-black text-sky transition-transform active:scale-95"
          >
            看回顧
          </button>
          <button
            type="button"
            onClick={dismissNudge}
            aria-label="收起學期回顧提醒"
            className="grid size-10 shrink-0 place-items-center rounded-full text-xl leading-none font-black"
          >
            ×
          </button>
        </section>
      )}

      {nearLimit.length > 0 && (
        <section className="rounded-3xl border-2 border-ink bg-white p-4 text-ink dark:border-pink dark:bg-white/5 dark:text-white">
          <h2 className="text-sm font-black">快到扣考線了</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {nearLimit.map(({ course, summary }) => (
              <li key={course.id} className="text-sm font-bold text-red-700 dark:text-pink">
                {course.name}:
                {summary.remainingPeriods! < 0
                  ? `已缺 ${summary.missedPeriods} 節,達到扣考線(${summary.limitPeriods} 節)`
                  : summary.remainingPeriods === 0
                    ? `再缺 1 節就扣考(已缺 ${summary.missedPeriods} 節)`
                    : `還能缺 ${summary.remainingPeriods} 節(已缺 ${summary.missedPeriods} 節)`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-bold text-ink/60 dark:text-white/60">依你記的出缺席估算,實際以學校紀錄為準。</p>
        </section>
      )}

      <AttendancePrompt unmarked={unmarked} now={now} onMark={handleMark} error={attendanceError} />

      {current ? (
        <div className="flex items-start justify-between gap-4 rounded-3xl bg-lime p-5 text-ink">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-wide uppercase">現在上課中</p>
            <p className="mt-1 text-2xl font-black">{current.course.name}</p>
            <p className="mt-1 text-sm font-bold">
              {current.timeSlot.startTime}–{current.timeSlot.endTime}
              {current.course.location ? ` · ${current.course.location}` : ""}
            </p>
            {relevantNotes(current.course, current.startAt).map((text, index) => (
              <p key={index} className="mt-2 text-sm font-bold">
                備註:{text}
              </p>
            ))}
            <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-black text-lime tabular-nums">
              還有 {msUntilEnd <= FINAL_COUNTDOWN_MS ? `${formatCountdown(msUntilEnd)} ` : formatDuration(msUntilEnd)}下課
            </p>
          </div>
          <ClassProgressRing
            startAt={current.startAt}
            endAt={current.endAt}
            now={now}
            finalCountdownMs={FINAL_COUNTDOWN_MS}
          />
        </div>
      ) : justEnded ? (
        <div className="class-end-pop rounded-3xl bg-lime p-5 text-ink">
          <p className="text-xs font-black tracking-wide">{justEnded.course.name} 結束了</p>
          <p className="mt-1 text-3xl font-black">下課啦！</p>
          {next && (
            <p className="mt-3 text-sm font-bold">
              下一堂 · {formatOccurrenceDay(next, now)} {next.timeSlot.startTime} {next.course.name}
            </p>
          )}
        </div>
      ) : next ? (
        <div className="rounded-3xl bg-pink p-5 text-ink">
          <p className="text-xs font-black tracking-wide uppercase">
            下一堂課 · {formatOccurrenceDay(next, now)} {next.timeSlot.startTime}
          </p>
          <p className="mt-1 text-2xl font-black">{next.course.name}</p>
          {next.course.location && <p className="mt-1 text-sm font-bold">{next.course.location}</p>}
          {relevantNotes(next.course, next.startAt).map((text, index) => (
            <p key={index} className="mt-2 text-sm font-bold">
              備註:{text}
            </p>
          ))}
          <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-black text-pink">
            還有 {formatDuration(next.startAt.getTime() - now.getTime())}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-5 text-sm font-bold text-ink/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
          接下來一週沒有課了
        </div>
      )}

      <FocusCard
        run={focus.run}
        courseName={focusCourseName}
        todayMinutes={todayFocusMinutes}
        onStart={() => setFocusSetupLengths(focusLengthsFrom(loadSettings()))}
        onOpen={openFocusScreen}
      />

      <ExamCountdown
        exams={examCountdown}
        now={now}
        onOpen={(item) => setPrepFor({ courseId: item.course.id, eventId: item.event.id })}
      />

      <UpcomingEvents events={homeEvents} now={now} onToggleDone={handleToggleDone} error={eventError} />

      <WeeklyTimetable
        schedule={schedule}
        today={now}
        settings={settings}
        attendance={schedule.attendance}
        onMarkAttendance={handleMark}
      />

      {(semester || holiday || showReviewCard) && (
        <div className="flex gap-3">
          {semester?.kind === "before" && (
            <div className={stripCardClass}>
              <p className={stripLabelClass}>開學倒數</p>
              <p className="mt-1 text-lg font-black">
                {semester.daysUntilStart === 1 ? "明天開學" : `還有 ${semester.daysUntilStart} 天`}
              </p>
            </div>
          )}
          {semester?.kind === "during" && (
            <div className={stripCardClass}>
              <p className={stripLabelClass}>學期進度</p>
              <p className="mt-1 text-lg font-black">
                第 {semester.week} 週
                {semester.totalWeeks !== null && (
                  <span className="text-xs font-bold text-ink/60 dark:text-white/60"> / 共 {semester.totalWeeks} 週</span>
                )}
              </p>
              {semester.fraction !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15">
                  <div
                    className="h-full rounded-full bg-ink dark:bg-lime"
                    style={{ width: `${Math.round(semester.fraction * 100)}%` }}
                  />
                </div>
              )}
              {hasReview && (
                <button
                  type="button"
                  onClick={showReview}
                  className="-mx-1 mt-1.5 rounded-full px-1 py-1.5 text-xs font-black underline decoration-2 underline-offset-2"
                >
                  看學期回顧 ›
                </button>
              )}
            </div>
          )}
          {showReviewCard && (
            <button type="button" onClick={showReview} className={`${stripCardClass} text-left`}>
              <p className={stripLabelClass}>學期回顧</p>
              <p className="mt-1 text-lg font-black">點開看看 ›</p>
            </button>
          )}
          {holiday && (
            <div className={stripCardClass}>
              <p className={stripLabelClass}>{holiday.kind === "ongoing" ? "放假中" : "下次放假"}</p>
              <p className="mt-1 truncate text-lg font-black">
                {holiday.kind === "ongoing"
                  ? holiday.name
                  : holiday.days === 1
                    ? "明天"
                    : `還有 ${holiday.days} 天`}
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-ink/60 dark:text-white/60">
                {holiday.kind === "ongoing"
                  ? `放到 ${formatDateRange(holiday.endDate, holiday.endDate)}`
                  : `${holiday.name} · ${formatDateRange(holiday.startDate, holiday.endDate)}`}
              </p>
            </div>
          )}
        </div>
      )}

      {prepCourse && prepExam && (
        <ExamPrepSheet
          course={prepCourse}
          exam={prepExam}
          now={now}
          onChange={(checklist) => handlePrepChange(prepCourse.id, prepExam.id, checklist)}
          onClose={() => setPrepFor(null)}
        />
      )}
      {focusSetupLengths && (
        <FocusSetupSheet
          courses={schedule.courses}
          lengths={focusSetupLengths}
          onStart={handleFocusStart}
          onClose={() => setFocusSetupLengths(null)}
        />
      )}
      {focusScreenOpen && focus.run && (
        <FocusTimerOverlay
          run={focus.run}
          courseName={focusCourseName}
          todayMinutes={todayFocusMinutes}
          onEnd={focus.end}
          onNext={focus.next}
          onMinimize={minimizeFocusScreen}
        />
      )}
      {openReview && <SemesterReviewStory review={openReview} onClose={closeReview} />}
    </main>
  );
}
