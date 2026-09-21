function formatMonthDay(dateKey: string, includeYear: boolean): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return includeYear ? `${year}/${month}/${day}` : `${month}/${day}`;
}

/** "10/5" for one day, "10/5–10/19" for a range; adds the year when it isn't the current one. */
export function formatDateRange(startDate: string, endDate: string): string {
  const currentYear = String(new Date().getFullYear());
  const includeYear = !startDate.startsWith(currentYear) || !endDate.startsWith(currentYear);
  const start = formatMonthDay(startDate, includeYear);
  return startDate === endDate ? start : `${start}–${formatMonthDay(endDate, includeYear)}`;
}
