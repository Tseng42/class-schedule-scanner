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
  { name: "元旦", startDate: "2027-01-01", endDate: "2027-01-01" },
];
