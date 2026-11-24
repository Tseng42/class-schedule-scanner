import { useEffect, useState } from "react";

type Direction = "up" | "down" | "auto";

/** Matches the roll-in / roll-out animations in index.css. */
const ROLL_MS = 300;

interface RollingNumberProps {
  /** Any text; only its digits roll, everything else is shown as is. */
  value: string;
  /** "down" for countdowns (new digits drop in from above), "up" for counts; "auto" compares the numbers. */
  direction?: Direction;
  className?: string;
}

/** Whether `next` reads as a smaller number than `previous`, judged by the first number that differs ("第 12 週" → "第 13 週" goes up). */
function goesDown(previous: string, next: string): boolean {
  const before = previous.match(/\d+/g)?.map(Number) ?? [];
  const after = next.match(/\d+/g)?.map(Number) ?? [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    if (after[i] !== before[i]) return after[i] < before[i];
  }
  return after.length < before.length;
}

/** One digit slot: when the digit changes, the old one slides out as the new one slides in. */
function RollingDigit({ char, rollsDown }: { char: string; rollsDown: boolean }) {
  const [shown, setShown] = useState(char);
  const [leaving, setLeaving] = useState<{ char: string; down: boolean; id: number } | null>(null);
  if (char !== shown) {
    setLeaving({ char: shown, down: rollsDown, id: (leaving?.id ?? 0) + 1 });
    setShown(char);
  }
  const down = leaving?.down ?? rollsDown;

  // Cleared on a timer rather than animationend, which never fires while a page isn't being painted.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), ROLL_MS + 50);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <span className="roll-digit">
      {leaving && (
        <span key={`out-${leaving.id}`} className={down ? "roll-out-down" : "roll-out-up"}>
          {leaving.char}
        </span>
      )}
      <span key={`in-${leaving?.id ?? 0}`} className={leaving ? (down ? "roll-in-down" : "roll-in-up") : undefined}>
        {shown}
      </span>
    </span>
  );
}

/**
 * Text whose digits roll like a scoreboard when they change, in the spirit of
 * Apple's numericText content transition. Screen readers get the plain text.
 */
export function RollingNumber({ value, direction = "auto", className }: RollingNumberProps) {
  const [previous, setPrevious] = useState(value);
  const [rollsDown, setRollsDown] = useState(direction === "down");
  if (value !== previous) {
    setRollsDown(direction === "auto" ? goesDown(previous, value) : direction === "down");
    setPrevious(value);
  }

  const chars = [...value];
  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {chars.map((char, index) => {
          // Keyed from the right, so the ones digit stays the ones digit when "10:00" becomes "9:59".
          const position = chars.length - 1 - index;
          return /\d/.test(char) ? (
            <RollingDigit key={`d${position}`} char={char} rollsDown={rollsDown} />
          ) : (
            <span key={`t${position}`}>{char}</span>
          );
        })}
      </span>
    </span>
  );
}
