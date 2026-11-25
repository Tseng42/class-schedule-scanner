import { useMemo } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import { BADGES, LEVEL_NAMES, badgeProgress, levelKey } from "../services/achievements/achievements";
import { toDateKey } from "../services/scheduling/dateKey";
import { formatDateRange } from "../lib/formatDate";

interface AchievementWallProps {
  schedule: Schedule;
  settings: AppSettings;
}

/** Every badge: earned levels in colour, the rest grey with how far along it is. */
export function AchievementWall({ schedule, settings }: AchievementWallProps) {
  const progress = useMemo(() => badgeProgress(schedule, settings, new Date()), [schedule, settings]);
  const earned = schedule.achievements ?? {};

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        用你記的點名、專注、作業、考試、成績和學分自動拿到,拿到就一直留著。請假和公假不會中斷「不翹課」。
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BADGES.map((badge) => {
          const count = progress[badge.id];
          const earnedLevels = badge.levels.filter((_, index) => earned[levelKey(badge.id, index + 1)]).length;
          const next = badge.levels[earnedLevels];
          const firstEarnedAt = earned[levelKey(badge.id, 1)];
          return (
            <li
              key={badge.id}
              className={`flex gap-3 rounded-2xl px-3 py-3 ${earnedLevels > 0 ? "bg-white" : "bg-white/50"}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-11 shrink-0 place-items-center rounded-full text-2xl ${
                  earnedLevels > 0 ? "bg-lime" : "bg-ink/10 opacity-50 grayscale"
                }`}
              >
                {badge.emoji}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-black">
                  {badge.name}
                  {badge.levels.length > 1 &&
                    badge.levels.map((_, index) => (
                      <span
                        key={index}
                        className={`rounded-full px-1.5 text-[10px] leading-4 font-black ${
                          index < earnedLevels ? "bg-ink text-lime" : "bg-ink/10 text-ink/40"
                        }`}
                      >
                        {LEVEL_NAMES[index]}
                      </span>
                    ))}
                </span>
                <span className="text-xs font-bold opacity-70">
                  {badge.rule.replace("{n}", String(next ?? badge.levels[badge.levels.length - 1]))}
                </span>
                {next !== undefined && next > 1 && (
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                      <span
                        className="block h-full rounded-full bg-ink"
                        style={{ width: `${Math.min(100, Math.round((count / next) * 100))}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[10px] font-black tabular-nums opacity-70">
                      {Math.min(count, next)}/{next} {badge.unit}
                    </span>
                  </span>
                )}
                {next === undefined && firstEarnedAt && (
                  <span className="mt-0.5 text-[10px] font-black opacity-60">
                    {badge.levels.length > 1 ? "全部拿到了" : "拿到了"} ·{" "}
                    {formatDateRange(toDateKey(new Date(firstEarnedAt)), toDateKey(new Date(firstEarnedAt)))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
