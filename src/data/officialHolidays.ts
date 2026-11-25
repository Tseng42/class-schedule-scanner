/**
 * Taiwan's official government holiday calendar (中華民國115年政府行政機關辦公日曆表),
 * already adjusted for weekend-overlap makeup days. Source: 行政院人事行政總處.
 * A specific school's actual calendar can differ — this is a starting point the
 * user reviews and edits, not an authoritative school calendar.
 */
export interface OfficialHoliday {
  name: string;
  startDate: string;
  endDate: string;
}

export const OFFICIAL_HOLIDAYS_TW_2026: OfficialHoliday[] = [
  { name: "元旦", startDate: "2026-01-01", endDate: "2026-01-01" },
  { name: "春節", startDate: "2026-02-14", endDate: "2026-02-22" },
  { name: "228和平紀念日", startDate: "2026-02-27", endDate: "2026-03-01" },
  { name: "兒童節・清明節", startDate: "2026-04-03", endDate: "2026-04-06" },
  { name: "勞動節", startDate: "2026-05-01", endDate: "2026-05-03" },
  { name: "端午節", startDate: "2026-06-19", endDate: "2026-06-21" },
  { name: "中秋節・教師節", startDate: "2026-09-25", endDate: "2026-09-28" },
  { name: "國慶日", startDate: "2026-10-09", endDate: "2026-10-11" },
  { name: "臺灣光復節", startDate: "2026-10-24", endDate: "2026-10-26" },
  { name: "行憲紀念日", startDate: "2026-12-25", endDate: "2026-12-27" },
];

/**
 * 中華民國116年政府行政機關辦公日曆表, approved 2026-05-21. Dates as reported by
 * ETtoday (2026-05-21) and 自由時報 (2026-10-10). 勞動節 is listed as a 3-day break,
 * so it runs through Sunday 5/2. 端午、中秋、教師節 fall midweek and are one day each.
 */
export const OFFICIAL_HOLIDAYS_TW_2027: OfficialHoliday[] = [
  { name: "元旦", startDate: "2027-01-01", endDate: "2027-01-03" },
  { name: "春節", startDate: "2027-02-04", endDate: "2027-02-10" },
  { name: "228和平紀念日", startDate: "2027-02-27", endDate: "2027-03-01" },
  { name: "兒童節・清明節", startDate: "2027-04-03", endDate: "2027-04-06" },
  { name: "勞動節", startDate: "2027-04-30", endDate: "2027-05-02" },
  { name: "端午節", startDate: "2027-06-09", endDate: "2027-06-09" },
  { name: "中秋節", startDate: "2027-09-15", endDate: "2027-09-15" },
  { name: "教師節", startDate: "2027-09-28", endDate: "2027-09-28" },
  { name: "國慶日", startDate: "2027-10-09", endDate: "2027-10-11" },
  { name: "臺灣光復節", startDate: "2027-10-23", endDate: "2027-10-25" },
  { name: "行憲紀念日", startDate: "2027-12-24", endDate: "2027-12-26" },
  { name: "元旦補假", startDate: "2027-12-31", endDate: "2027-12-31" },
];

/** What 「一鍵加入國定假日」 adds. */
export const OFFICIAL_HOLIDAYS_TW = [...OFFICIAL_HOLIDAYS_TW_2026, ...OFFICIAL_HOLIDAYS_TW_2027];
