import { formatCountdown } from "../services/scheduling/nextClass";
import { RollingNumber } from "./RollingNumber";

const SIZE = 76;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ClassProgressRingProps {
  startAt: Date;
  endAt: Date;
  now: Date;
  /** Within this much of the end, the centre switches from minutes to a m:ss countdown. */
  finalCountdownMs: number;
}

/** How far through the class we are, drawn as a ring that fills clockwise. */
export function ClassProgressRing({ startAt, endAt, now, finalCountdownMs }: ClassProgressRingProps) {
  const total = endAt.getTime() - startAt.getTime();
  const msLeft = Math.max(0, endAt.getTime() - now.getTime());
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - msLeft / total)) : 1;
  const isFinalCountdown = msLeft <= finalCountdownMs;

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} aria-hidden="true">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-ink/15" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="stroke-ink motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {isFinalCountdown ? (
          <RollingNumber value={formatCountdown(msLeft)} direction="down" className="text-base font-black tabular-nums" />
        ) : (
          <>
            <RollingNumber
              value={String(Math.round(msLeft / 60000))}
              direction="down"
              className="text-xl font-black tabular-nums"
            />
            <span className="mt-0.5 text-[10px] font-black">分</span>
          </>
        )}
      </div>
    </div>
  );
}
