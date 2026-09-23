import { DAY_OF_WEEK_LABELS } from "../schema/course";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { buildWeekLayout } from "../services/scheduling/weekLayout";

interface WeeklyWorkloadChartProps {
  schedule: Schedule;
  settings: AppSettings;
  today: Date;
}

const CHART_HEIGHT = 72;

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function WeeklyWorkloadChart({ schedule, settings, today }: WeeklyWorkloadChartProps) {
  const { columns } = buildWeekLayout(schedule, settings, today, 0);

  const dayTotals = columns.map((column) => {
    const minutes = column.items
      .filter((item) => item.occurrence.cancelledReason === undefined)
      .reduce((sum, item) => sum + (item.end - item.start), 0);
    return { day: column.day, isToday: column.isToday, hours: minutes / 60 };
  });

  const totalHours = dayTotals.reduce((sum, item) => sum + item.hours, 0);
  if (totalHours === 0) return null;

  const maxHours = Math.max(...dayTotals.map((item) => item.hours));
  const busiestDay = dayTotals.reduce((busiest, item) => (item.hours > busiest.hours ? item : busiest));

  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-xs font-black tracking-wide text-ink/40 uppercase dark:text-white/40">本週上課量</h2>
        <p className="text-xs font-bold text-ink/50 dark:text-white/50">
          共 {formatHours(totalHours)} 小時・{DAY_OF_WEEK_LABELS[busiestDay.day]}最忙
        </p>
      </div>
      <div className="mt-3 flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {dayTotals.map((item) => (
          <div key={item.day} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={`w-full rounded-t-lg transition-[height] ${
                item.isToday ? "bg-lime" : "bg-sky/50 dark:bg-sky/30"
              }`}
              style={{ height: item.hours > 0 ? Math.max(6, (item.hours / maxHours) * CHART_HEIGHT) : 2 }}
            />
            <span
              className={`text-[10px] font-black ${
                item.isToday ? "text-ink dark:text-lime" : "text-ink/40 dark:text-white/40"
              }`}
            >
              {DAY_OF_WEEK_LABELS[item.day].replace("週", "")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
