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
}

/** How far through the class we are, with an m:ss countdown to the end in the middle. */
export function ClassProgressRing({ startAt, endAt, now }: ClassProgressRingProps) {
  const total = endAt.getTime() - startAt.getTime();
  const msLeft = Math.max(0, endAt.getTime() - now.getTime());
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - msLeft / total)) : 1;
  // A class of 100 minutes or more reads 1xx:ss, a digit wider than the ring's middle fits at the larger size.
  const long = msLeft >= 100 * 60000;

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
        <RollingNumber
          value={formatCountdown(msLeft)}
          direction="down"
          className={`${long ? "text-sm" : "text-base"} font-black tabular-nums`}
        />
      </div>
    </div>
  );
}
