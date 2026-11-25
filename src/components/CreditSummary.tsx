import { useState } from "react";
import type { Course } from "../schema/course";
import type { Schedule } from "../schema/schedule";
import { DEFAULT_GRADUATION_CREDITS, type AppSettings } from "../schema/settings";
import { RollingNumber } from "./RollingNumber";
import { creditAverages } from "../services/grades/grades";

interface CreditSummaryProps {
  courses: Course[];
  pastSemesters: Schedule["pastSemesters"];
  settings: AppSettings;
  onChangeGoal: (credits: number) => void;
}

function sumCredits(courses: Course[]): number {
  return courses.reduce((total, course) => total + (course.credits ?? 0), 0);
}

/** 所有課程's header card: this semester's credits, everything so far, and how far that is toward graduating. */
export function CreditSummary({ courses, pastSemesters, settings, onChangeGoal }: CreditSummaryProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const goal = settings.graduationCredits ?? DEFAULT_GRADUATION_CREDITS;
  const [goalText, setGoalText] = useState(String(goal));

  const thisSemester = sumCredits(courses);
  const past = Object.values(pastSemesters ?? {});
  const pastCredits = past.reduce((total, semester) => total + sumCredits(semester.courses), 0);
  const total = thisSemester + pastCredits;
  const missing = courses.filter((course) => course.credits === undefined).length;
  const pastMissing = past.reduce(
    (count, semester) => count + semester.courses.filter((course) => course.credits === undefined).length,
    0,
  );
  const fraction = Math.min(1, total / goal);
  const semesterAverages = creditAverages(courses);
  const overallAverages = creditAverages([...courses, ...past.flatMap((semester) => semester.courses)]);

  const saveGoal = () => {
    const value = Number(goalText.trim());
    if (Number.isInteger(value) && value > 0 && value <= 400) onChangeGoal(value);
    else setGoalText(String(goal));
    setEditingGoal(false);
  };

  return (
    <section className="rounded-3xl bg-sky p-4 text-ink">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black text-ink/60">這學期</p>
          <p className="text-2xl font-black tabular-nums">
            <RollingNumber value={String(thisSemester)} direction="up" /> <span className="text-sm">學分</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-ink/60">累計</p>
          <p className="text-2xl font-black tabular-nums">
            <RollingNumber value={String(total)} direction="up" />
            <span className="text-sm font-bold text-ink/60"> / {goal}</span>
          </p>
        </div>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-label="畢業學分進度"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={total}
      >
        <div
          className="h-full rounded-full bg-ink motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-bold text-ink/70">
        <span>
          {total >= goal ? "已達畢業學分 🎓" : `離畢業還差 ${goal - total} 學分`}
          {missing > 0 && ` · 還有 ${missing} 門沒填學分`}
          {pastMissing > 0 && ` · 過去的學期有 ${pastMissing} 門沒填`}
        </span>
        {editingGoal ? (
          <span className="flex items-center gap-1">
            畢業門檻
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              onBlur={saveGoal}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveGoal();
              }}
              aria-label="畢業門檻學分"
              className="w-14 rounded-lg border-2 border-ink/20 bg-white px-2 py-0.5 text-xs font-black text-ink focus:border-ink focus:outline-none"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setGoalText(String(goal));
              setEditingGoal(true);
            }}
            className="-my-1 rounded-full px-2 py-1 font-black underline decoration-2 underline-offset-2"
          >
            改畢業門檻
          </button>
        )}
      </div>
      {overallAverages && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-ink/10 pt-2 text-xs font-bold">
          {semesterAverages && (
            <span>
              這學期平均 <span className="font-black tabular-nums">{semesterAverages.average}</span>
            </span>
          )}
          <span>
            累計平均 <span className="font-black tabular-nums">{overallAverages.average}</span>
          </span>
          <span>
            GPA <span className="font-black tabular-nums">{overallAverages.gpa.toFixed(2)}</span>
            <span className="text-ink/60">(4.3 制參考)</span>
          </span>
        </div>
      )}
      <p className="mt-1 text-[10px] font-bold text-ink/60">
        {overallAverages &&
          "平均照學分加權,只算有學分和學期總成績的課;GPA 依臺大、臺師大的 4.3 制換算,各校不同,以學校公告為準。"}
        四年制學士班依法至少 {DEFAULT_GRADUATION_CREDITS} 學分,實際以你系上的規定為準。
      </p>
    </section>
  );
}
