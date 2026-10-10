// @ts-check
/**
 * Pure schedule → LINE message logic, no I/O.
 *
 * Mirrors the client's rules in src/services/scheduling/nextClass.ts. It is a
 * separate implementation because Vercel runs these files as plain Node ESM,
 * which cannot import the app's extensionless Vite-style TypeScript modules.
 * If the client's "does this class meet on this date" rules change, change
 * them here too.
 */

/** @typedef {{ id: string, dayOfWeek: string, startTime: string, endTime: string }} TimeSlot */
/** @typedef {{ type: "weekly", startDate?: string, endDate?: string } | { type: "once", date: string }} Recurrence */
/** @typedef {{ startDate: string, endDate: string, reason?: string }} Cancellation */
/** @typedef {{ kind: string, title: string, date: string, time?: string }} CourseEvent */
/** @typedef {{ text: string, date?: string }} Note */
/**
 * @typedef {object} Course
 * @property {string} id
 * @property {string} name
 * @property {string} [location]
 * @property {TimeSlot[]} timeSlots
 * @property {Recurrence} recurrence
 * @property {Note[] | string} [notes] A plain string in documents saved before notes became a list.
 * @property {Cancellation[]} [cancellations]
 * @property {CourseEvent[]} [events]
 */
/** @typedef {{ name: string, startDate: string, endDate: string }} Holiday */
/** @typedef {{ courses?: Course[], holidays?: Holiday[] }} Schedule */
/**
 * @typedef {object} Settings
 * @property {number} [reminderMinutes]
 * @property {string} [semesterStartDate]
 * @property {string} [semesterEndDate]
 * @property {boolean} [lineDailySummary]
 * @property {string} [lineDailyTime]
 * @property {boolean} [lineClassReminder]
 */
/** @typedef {{ course: Course, slot: TimeSlot, dateKey: string, startMs: number }} Occurrence */
/** @typedef {{ dailySentDate?: string, reminderKeys?: string[] }} NotifyState */
/**
 * @typedef {object} TickPlan
 * @property {"disabled" | "already-sent" | "not-due" | "nothing-today" | "due"} dailyStatus
 * @property {string | null} dailyText
 * @property {string | null} reminderText
 * @property {string[]} reminderKeys
 * @property {NotifyState | null} nextState What to persist before sending, or null when nothing is due.
 */

// Taiwan has no daylight saving time, so a fixed +8h offset is exact.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
/** @type {Record<string, string>} */
const EVENT_KIND_LABELS = { exam: "考試", assignment: "作業", other: "其他" };

export const DEFAULT_DAILY_TIME = "07:00";
export const DEFAULT_REMINDER_MINUTES = 10;
/**
 * The scheduler only calls in every ~10 minutes, so a reminder becomes due this
 * much earlier than the configured lead time. Without it, a tick landing just
 * before the window would be followed by one landing after the class started.
 */
export const TICK_SLACK_MINUTES = 10;
const UPCOMING_EVENT_DAYS = 7;
const LINE_TEXT_LIMIT = 4800;

/** @param {number} value */
function pad(value) {
  return String(value).padStart(2, "0");
}

/** @param {string} dateKey */
function splitDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

/**
 * Calendar date and minutes-past-midnight in Taiwan for an instant.
 * @param {number} epochMs
 */
export function taipeiParts(epochMs) {
  const shifted = new Date(epochMs + TAIPEI_OFFSET_MS);
  return {
    dateKey: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/**
 * @param {string} dateKey
 * @param {number} days
 */
export function addDays(dateKey, days) {
  const { year, month, day } = splitDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** @param {string} dateKey */
function weekdayIndex(dateKey) {
  const { year, month, day } = splitDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * The instant a Taiwan wall-clock date + "HH:mm" refers to.
 * @param {string} dateKey
 * @param {string} time
 */
export function toEpochMs(dateKey, time) {
  const { year, month, day } = splitDateKey(dateKey);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute) - TAIPEI_OFFSET_MS;
}

/**
 * @param {string | undefined} time
 * @param {string} fallback
 */
function timeToMinutes(time, fallback) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
  const [, hour, minute] = match ?? /^(\d\d):(\d\d)$/.exec(fallback) ?? [];
  return Number(hour) * 60 + Number(minute);
}

/**
 * @param {string} dateKey
 * @param {{ startDate: string, endDate: string }} range
 */
function isWithin(dateKey, range) {
  return dateKey >= range.startDate && dateKey <= range.endDate;
}

/**
 * @param {Schedule} schedule
 * @param {string} dateKey
 */
function isHoliday(schedule, dateKey) {
  return (schedule.holidays ?? []).some((holiday) => isWithin(dateKey, holiday));
}

/**
 * @param {Course} course
 * @param {string} dateKey
 */
function findCancellation(course, dateKey) {
  return (course.cancellations ?? []).find((item) => isWithin(dateKey, item));
}

/**
 * A course's own recurrence bounds win; otherwise the semester dates apply.
 * @param {Course} course
 * @param {string} dateKey
 * @param {Settings} settings
 */
function isActiveOn(course, dateKey, settings) {
  const recurrence = course.recurrence;
  if (!recurrence) return false;
  if (recurrence.type === "once") return recurrence.date === dateKey;
  const startDate = recurrence.startDate ?? settings.semesterStartDate;
  const endDate = recurrence.endDate ?? settings.semesterEndDate;
  if (startDate && dateKey < startDate) return false;
  if (endDate && dateKey > endDate) return false;
  return true;
}

/**
 * Every class meeting on a Taiwan calendar date, split into the ones that
 * happen and the ones a course-specific cancellation removed. A school-wide
 * holiday removes everything and reports nothing as "cancelled".
 * @param {Schedule} schedule
 * @param {Settings} settings
 * @param {string} dateKey
 * @returns {{ meeting: Occurrence[], cancelled: { course: Course, reason: string }[] }}
 */
export function classesOn(schedule, settings, dateKey) {
  /** @type {Occurrence[]} */
  const meeting = [];
  /** @type {{ course: Course, reason: string }[]} */
  const cancelled = [];
  if (isHoliday(schedule, dateKey)) return { meeting, cancelled };

  const dayCode = DAY_CODES[weekdayIndex(dateKey)];
  for (const course of schedule.courses ?? []) {
    if (!isActiveOn(course, dateKey, settings)) continue;
    const slots = (course.timeSlots ?? []).filter((slot) => slot.dayOfWeek === dayCode);
    if (slots.length === 0) continue;
    const cancellation = findCancellation(course, dateKey);
    if (cancellation) {
      cancelled.push({ course, reason: cancellation.reason?.trim() || "停課" });
      continue;
    }
    for (const slot of slots) {
      meeting.push({ course, slot, dateKey, startMs: toEpochMs(dateKey, slot.startTime) });
    }
  }
  meeting.sort((a, b) => a.startMs - b.startMs);
  return { meeting, cancelled };
}

/**
 * Undated notes always apply; dated ones only on their own day.
 * @param {Course} course
 * @param {string} dateKey
 * @returns {string[]}
 */
function notesFor(course, dateKey) {
  const notes = course.notes;
  if (typeof notes === "string") return notes.trim() ? [notes.trim()] : [];
  return (notes ?? []).filter((note) => !note.date || note.date === dateKey).map((note) => note.text);
}

/**
 * Events dated from `fromKey` through `toKey` inclusive, soonest first.
 * @param {Schedule} schedule
 * @param {string} fromKey
 * @param {string} toKey
 */
function eventsBetween(schedule, fromKey, toKey) {
  return (schedule.courses ?? [])
    .flatMap((course) => (course.events ?? []).map((event) => ({ course, event })))
    .filter(({ event }) => event.date >= fromKey && event.date <= toKey)
    .sort((a, b) => `${a.event.date} ${a.event.time ?? ""}`.localeCompare(`${b.event.date} ${b.event.time ?? ""}`));
}

/** @param {string} dateKey */
function formatHeadingDate(dateKey) {
  const { month, day } = splitDateKey(dateKey);
  return `${month}/${day}(${DAY_LABELS[weekdayIndex(dateKey)]})`;
}

/** @param {Occurrence} occurrence */
function formatClassLine(occurrence) {
  const { course, slot } = occurrence;
  const location = course.location?.trim();
  return `${slot.startTime}–${slot.endTime} ${course.name}${location ? ` · ${location}` : ""}`;
}

/** @param {{ course: Course, event: CourseEvent }} item */
function formatEventLine({ course, event }) {
  const kind = EVENT_KIND_LABELS[event.kind] ?? EVENT_KIND_LABELS.other;
  return `${kind} ${event.title}${event.time ? ` ${event.time}` : ""}(${course.name})`;
}

/** @param {number} ms */
function formatRemaining(ms) {
  const totalMinutes = Math.max(1, Math.round(ms / MINUTE_MS));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  /** @type {string[]} */
  const parts = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} 分`);
  return parts.join(" ");
}

/** @param {string} text */
function clampForLine(text) {
  return text.length > LINE_TEXT_LIMIT ? `${text.slice(0, LINE_TEXT_LIMIT)}…` : text;
}

/**
 * The morning digest for one Taiwan calendar date, or null when there is
 * nothing to say (no class, no cancellation, and no event that day).
 * @param {Schedule} schedule
 * @param {Settings} settings
 * @param {string} dateKey
 * @returns {string | null}
 */
export function buildDailySummary(schedule, settings, dateKey) {
  const { meeting, cancelled } = classesOn(schedule, settings, dateKey);
  const todayEvents = eventsBetween(schedule, dateKey, dateKey);
  if (meeting.length === 0 && cancelled.length === 0 && todayEvents.length === 0) return null;

  /** @type {string[]} */
  const lines = [`${formatHeadingDate(dateKey)}今日課表`, ""];
  if (meeting.length === 0) {
    lines.push("今天沒有要上的課");
  } else {
    for (const occurrence of meeting) {
      lines.push(formatClassLine(occurrence));
      for (const note of notesFor(occurrence.course, dateKey)) lines.push(`　備註:${note}`);
    }
  }

  if (cancelled.length > 0) {
    lines.push("", "今日停課");
    for (const { course, reason } of cancelled) lines.push(`・${course.name}(${reason})`);
  }

  if (todayEvents.length > 0) {
    lines.push("", "今日事項");
    for (const item of todayEvents) lines.push(`・${formatEventLine(item)}`);
  }

  const upcoming = eventsBetween(schedule, addDays(dateKey, 1), addDays(dateKey, UPCOMING_EVENT_DAYS));
  if (upcoming.length > 0) {
    lines.push("", "近期事項");
    for (const item of upcoming) {
      const { month, day } = splitDateKey(item.event.date);
      lines.push(`・${month}/${day} ${formatEventLine(item)}`);
    }
  }

  return clampForLine(lines.join("\n"));
}

/** @param {Occurrence} occurrence */
function reminderKey(occurrence) {
  return `${occurrence.dateKey}|${occurrence.course.id}|${occurrence.slot.id}`;
}

/**
 * Classes that have not started yet, are inside the reminder window, and have
 * not been reminded about.
 * @param {Schedule} schedule
 * @param {Settings} settings
 * @param {number} nowMs
 * @param {Set<string>} sentKeys
 * @returns {{ occurrence: Occurrence, key: string }[]}
 */
export function findDueReminders(schedule, settings, nowMs, sentKeys) {
  const lead = settings.reminderMinutes;
  const leadMinutes = typeof lead === "number" && lead > 0 ? lead : DEFAULT_REMINDER_MINUTES;
  const windowMs = (leadMinutes + TICK_SLACK_MINUTES) * MINUTE_MS;
  const todayKey = taipeiParts(nowMs).dateKey;
  const daysAhead = Math.ceil(windowMs / DAY_MS);

  /** @type {{ occurrence: Occurrence, key: string }[]} */
  const due = [];
  for (let offset = 0; offset <= daysAhead; offset++) {
    for (const occurrence of classesOn(schedule, settings, addDays(todayKey, offset)).meeting) {
      if (occurrence.startMs <= nowMs || occurrence.startMs - windowMs > nowMs) continue;
      const key = reminderKey(occurrence);
      if (!sentKeys.has(key)) due.push({ occurrence, key });
    }
  }
  return due;
}

/**
 * @param {{ occurrence: Occurrence }[]} due
 * @param {number} nowMs
 */
function buildReminderText(due, nowMs) {
  const todayKey = taipeiParts(nowMs).dateKey;
  /** @type {string[]} */
  const lines = ["上課提醒"];
  for (const { occurrence } of due) {
    const dayPrefix = occurrence.dateKey === todayKey ? "" : `${formatHeadingDate(occurrence.dateKey)} `;
    lines.push(`${dayPrefix}${formatClassLine(occurrence)}(還有 ${formatRemaining(occurrence.startMs - nowMs)})`);
    for (const note of notesFor(occurrence.course, occurrence.dateKey)) lines.push(`　備註:${note}`);
  }
  return clampForLine(lines.join("\n"));
}

/**
 * Drops reminder keys for dates before yesterday so the stored list stays small.
 * @param {string[]} keys
 * @param {string} todayKey
 */
function pruneKeys(keys, todayKey) {
  const cutoff = addDays(todayKey, -1);
  return keys.filter((key) => key.slice(0, 10) >= cutoff);
}

/**
 * Decides what one scheduler call should send. Pure: the caller persists
 * `nextState` (inside a transaction, so concurrent calls cannot both claim the
 * same message) and only then pushes the texts.
 * @param {Schedule} schedule
 * @param {Settings} settings
 * @param {NotifyState} state
 * @param {number} nowMs
 * @returns {TickPlan}
 */
export function planTick(schedule, settings, state, nowMs) {
  const { dateKey: todayKey, minutes: nowMinutes } = taipeiParts(nowMs);
  const sentKeys = Array.isArray(state.reminderKeys) ? state.reminderKeys : [];

  /** @type {TickPlan} */
  const plan = { dailyStatus: "disabled", dailyText: null, reminderText: null, reminderKeys: [], nextState: null };

  if (settings.lineDailySummary === true) {
    if (state.dailySentDate === todayKey) {
      plan.dailyStatus = "already-sent";
    } else if (nowMinutes < timeToMinutes(settings.lineDailyTime, DEFAULT_DAILY_TIME)) {
      plan.dailyStatus = "not-due";
    } else {
      plan.dailyText = buildDailySummary(schedule, settings, todayKey);
      plan.dailyStatus = plan.dailyText ? "due" : "nothing-today";
    }
  }

  if (settings.lineClassReminder === true) {
    const due = findDueReminders(schedule, settings, nowMs, new Set(sentKeys));
    if (due.length > 0) {
      plan.reminderKeys = due.map((item) => item.key);
      plan.reminderText = buildReminderText(due, nowMs);
    }
  }

  if (plan.dailyText || plan.reminderText) {
    /** @type {NotifyState} */
    const nextState = { reminderKeys: pruneKeys([...sentKeys, ...plan.reminderKeys], todayKey) };
    const dailySentDate = plan.dailyText ? todayKey : state.dailySentDate;
    if (dailySentDate) nextState.dailySentDate = dailySentDate;
    plan.nextState = nextState;
  }
  return plan;
}
