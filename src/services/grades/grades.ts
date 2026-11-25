import type { Course, GradeItem } from "../../schema/course";

/** Scores are shown to one decimal place. */
export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface GradeProgress {
  /** Sum of every item's weight; should be 100. */
  totalWeight: number;
  /** Points already earned toward the course grade (score × weight / 100 over scored items). */
  earned: number;
  /** Weight of the items still without a score. */
  remainingWeight: number;
}

export function gradeProgress(items: GradeItem[]): GradeProgress {
  let totalWeight = 0;
  let earned = 0;
  let remainingWeight = 0;
  for (const item of items) {
    totalWeight += item.weight;
    if (item.score === undefined) remainingWeight += item.weight;
    else earned += (item.score * item.weight) / 100;
  }
  return { totalWeight, earned, remainingWeight };
}

/**
 * The average score the unscored items need for the course to reach `goal`. Above 100
 * means out of reach; zero or below means it's already there. Null when nothing is left.
 */
export function scoreNeeded(progress: GradeProgress, goal: number): number | null {
  if (progress.remainingWeight <= 0) return null;
  return ((goal - progress.earned) / progress.remainingWeight) * 100;
}

/** The course's semester score: the official one if filled in, else worked out once every item has a score. */
export function courseScore(course: Course): number | undefined {
  if (course.finalScore !== undefined) return course.finalScore;
  const items = course.gradeItems ?? [];
  if (items.length === 0) return undefined;
  const progress = gradeProgress(items);
  if (progress.remainingWeight > 0 || progress.totalWeight <= 0) return undefined;
  return roundScore(progress.earned);
}

/**
 * Grade points on the 4.3 scale many Taiwanese universities use (臺大、臺師大),
 * from a 0–100 score. Schools draw the lines differently, so it's a reference only.
 */
export function gradePoint43(score: number): number {
  if (score >= 90) return 4.3;
  if (score >= 85) return 4.0;
  if (score >= 80) return 3.7;
  if (score >= 77) return 3.3;
  if (score >= 73) return 3.0;
  if (score >= 70) return 2.7;
  if (score >= 67) return 2.3;
  if (score >= 63) return 2.0;
  if (score >= 60) return 1.7;
  return 0;
}

export interface CreditAverages {
  /** 學分加權平均 on the 0–100 scale. */
  average: number;
  gpa: number;
  /** Credits that went into it. */
  credits: number;
}

/** Credit-weighted average and GPA over courses with both a score and at least one credit. */
export function creditAverages(courses: Course[]): CreditAverages | null {
  let credits = 0;
  let points = 0;
  let gradePoints = 0;
  for (const course of courses) {
    const score = courseScore(course);
    if (score === undefined || !course.credits) continue;
    credits += course.credits;
    points += score * course.credits;
    gradePoints += gradePoint43(score) * course.credits;
  }
  if (credits === 0) return null;
  return { average: roundScore(points / credits), gpa: Math.round((gradePoints / credits) * 100) / 100, credits };
}
