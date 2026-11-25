import type { Course } from "../../schema/course";
import type { AttendanceStatus, Schedule } from "../../schema/schedule";
import { DEFAULT_GRADUATION_CREDITS, type AppSettings } from "../../schema/settings";
import { courseScore } from "../grades/grades";
import { attendanceOf, trackingStartKey } from "../scheduling/attendance";
import { parseDateKey, toDateKey } from "../scheduling/dateKey";
import { getOccurrencesForDate } from "../scheduling/nextClass";
import { allTerms, type Term } from "../scheduling/terms";
import { mondayOf, shiftDays } from "../scheduling/weekLayout";

/*
 * 成就徽章. Earned from data the app already has, kept for good once earned. Few and
 * fairly hard, and the streak forgives 請假 and 公假: only a 沒去 breaks it.
 */

export type BadgeId =
  "early" | "perfect" | "streak" | "focus" | "tasks" | "prep" | "examWeek" | "target" | "halfway" | "graduate";

export interface BadgeDef {
  id: BadgeId;
  emoji: string;
  name: string;
  /** What earns it, with {n} for the level's threshold. */
  rule: string;
  /** Thresholds for 銅/銀/金, or one for a single-level badge. */
  levels: number[];
  /** What the progress counts, e.g. "堂". */
  unit: string;
}

export const BADGES: BadgeDef[] = [
  { id: "early", emoji: "☀️", name: "早八戰士", rule: "9 點前的課有到 {n} 堂", levels: [10, 30, 60], unit: "堂" },
  { id: "perfect", emoji: "🏅", name: "全勤", rule: "一門課整學期每堂都有到", levels: [1], unit: "門" },
  { id: "streak", emoji: "🔥", name: "不翹課", rule: "連續 {n} 週沒有「沒去」", levels: [4, 8, 16], unit: "週" },
  { id: "focus", emoji: "⏱️", name: "專注", rule: "累計專注 {n} 小時", levels: [10, 50, 100], unit: "小時" },
  { id: "tasks", emoji: "✅", name: "交作業", rule: "打勾完成 {n} 份作業", levels: [10, 30, 100], unit: "份" },
  { id: "prep", emoji: "📚", name: "複習完美", rule: "一次考試的複習清單全部打勾", levels: [1], unit: "次" },
  { id: "examWeek", emoji: "⚔️", name: "考試週生還", rule: "撐過一次考試週(7 天內 2 科以上)", levels: [1], unit: "次" },
  { id: "target", emoji: "🎯", name: "達標", rule: "一門課的學期總成績達到目標分數", levels: [1], unit: "門" },
  { id: "halfway", emoji: "🧗", name: "學分過半", rule: "累計學分達到畢業門檻的一半", levels: [1], unit: "" },
  { id: "graduate", emoji: "🎓", name: "畢業學分", rule: "累計學分達到畢業門檻", levels: [1], unit: "" },
];

export const LEVEL_NAMES = ["銅", "銀", "金"];

/** Storage key for one level of a badge, e.g. "early:2" for 早八戰士 銀. */
export function levelKey(id: BadgeId, level: number): string {
  return `${id}:${level}`;
}

/** Marks that count as being there. */
const ATTENDED = new Set<AttendanceStatus>(["present", "late", "official"]);
const EARLY_BEFORE = "09:00";

interface TermCounts {
  earlyAttended: number;
  perfectCourses: number;
  longestStreak: number;
}

/** Walks a term's class meetings that have ended, counting what the attendance badges need. */
function countTerm(term: Term): TermCounts {
  const { schedule, settings, now } = term;
  const startKey = trackingStartKey(schedule, settings);
  const counts: TermCounts = { earlyAttended: 0, perfectCourses: 0, longestStreak: 0 };
  if (!startKey) return counts;
  const todayKey = toDateKey(now);
  const end = settings.semesterEndDate;
  const endKey = end && end < todayKey ? end : todayKey;
  if (startKey > endKey) return counts;

  const perCourse = new Map<string, { meetings: number; attended: number }>();
  /** Monday key → whether that week had a class marked attended, and whether it had a 沒去. */
  const weeks = new Map<string, { attended: boolean; missed: boolean }>();

  for (let date = parseDateKey(startKey); toDateKey(date) <= endKey; date = shiftDays(date, 1)) {
    for (const occurrence of getOccurrencesForDate(schedule, date, settings)) {
      if (occurrence.endAt > now) continue;
      const status = attendanceOf(schedule, occurrence)?.status;
      const tally = perCourse.get(occurrence.course.id) ?? { meetings: 0, attended: 0 };
      tally.meetings += 1;
      if (status && ATTENDED.has(status)) tally.attended += 1;
      perCourse.set(occurrence.course.id, tally);

      if ((status === "present" || status === "late") && occurrence.timeSlot.startTime < EARLY_BEFORE) {
        counts.earlyAttended += 1;
      }
      const weekKey = toDateKey(mondayOf(date));
      const week = weeks.get(weekKey) ?? { attended: false, missed: false };
      if (status && ATTENDED.has(status)) week.attended = true;
      if (status === "absent") week.missed = true;
      weeks.set(weekKey, week);
    }
  }

  // Weeks without classes (holidays) or with nothing marked neither count nor break the run.
  let run = 0;
  for (const key of [...weeks.keys()].sort()) {
    const week = weeks.get(key)!;
    if (week.missed) run = 0;
    else if (week.attended) run += 1;
    counts.longestStreak = Math.max(counts.longestStreak, run);
  }

  if (term.finished) {
    counts.perfectCourses = [...perCourse.values()].filter(
      (tally) => tally.meetings > 0 && tally.attended === tally.meetings,
    ).length;
  }
  return counts;
}

/** Exams whose dates fall within 7 days of each other, two or more, all already past. */
function survivedExamWeeks(courses: Course[], todayKey: string): number {
  const dates = courses
    .flatMap((course) => course.events ?? [])
    .filter((event) => event.kind === "exam" && event.date < todayKey)
    .map((event) => parseDateKey(event.date).getTime())
    .sort((a, b) => a - b);
  let count = 0;
  let index = 0;
  while (index < dates.length) {
    let last = index;
    while (last + 1 < dates.length && dates[last + 1] - dates[index] < 7 * 86400000) last += 1;
    if (last > index) {
      count += 1;
      index = last + 1;
    } else index += 1;
  }
  return count;
}

/** Each badge's current count, toward its levels. */
export function badgeProgress(schedule: Schedule, settings: AppSettings, now: Date): Record<BadgeId, number> {
  const terms = allTerms(schedule, settings, now);
  const termCounts = terms.map(countTerm);
  const allCourses = terms.flatMap((term) => term.schedule.courses);
  const events = allCourses.flatMap((course) => course.events ?? []);
  const credits = allCourses.reduce((total, course) => total + (course.credits ?? 0), 0);
  const goal = settings.graduationCredits ?? DEFAULT_GRADUATION_CREDITS;
  const focusMinutes = Object.values(schedule.focusSessions ?? {}).reduce(
    (total, session) => total + session.minutes,
    0,
  );

  return {
    early: termCounts.reduce((total, counts) => total + counts.earlyAttended, 0),
    perfect: termCounts.reduce((total, counts) => total + counts.perfectCourses, 0),
    streak: Math.max(0, ...termCounts.map((counts) => counts.longestStreak)),
    focus: Math.floor(focusMinutes / 60),
    tasks: events.filter((event) => event.kind === "assignment" && event.done).length,
    prep: events.filter(
      (event) =>
        event.kind === "exam" && (event.checklist?.length ?? 0) > 0 && event.checklist!.every((item) => item.done),
    ).length,
    examWeek: survivedExamWeeks(allCourses, toDateKey(now)),
    target: allCourses.filter((course) => {
      const score = courseScore(course);
      return course.targetScore !== undefined && score !== undefined && score >= course.targetScore;
    }).length,
    halfway: credits >= goal / 2 ? 1 : 0,
    graduate: credits >= goal ? 1 : 0,
  };
}

/** Every badge level the counts reach, as storage keys. */
export function reachedLevels(progress: Record<BadgeId, number>): string[] {
  return BADGES.flatMap((badge) =>
    badge.levels.flatMap((threshold, index) =>
      progress[badge.id] >= threshold ? [levelKey(badge.id, index + 1)] : [],
    ),
  );
}

export const TOTAL_LEVELS = BADGES.reduce((total, badge) => total + badge.levels.length, 0);

/** "早八戰士 銀" or "全勤". */
export function levelLabel(key: string): string {
  const [id, level] = key.split(":");
  const badge = BADGES.find((item) => item.id === id);
  if (!badge) return key;
  return badge.levels.length > 1
    ? `${badge.emoji} ${badge.name} ${LEVEL_NAMES[Number(level) - 1]}`
    : `${badge.emoji} ${badge.name}`;
}
