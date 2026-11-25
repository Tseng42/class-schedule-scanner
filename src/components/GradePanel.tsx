import { useState } from "react";
import type { Course, GradeItem } from "../schema/course";
import { generateId } from "../lib/id";
import { courseScore, gradeProgress, roundScore, scoreNeeded } from "../services/grades/grades";

interface GradePanelProps {
  course: Course;
  passingScore: number;
  onChange: (next: Course) => void;
  onChangePassingScore: (score: number) => void;
}

/** A number typed into a field, or undefined when blank or outside [min, max]. */
function parseNumber(text: string, min: number, max: number): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "" || !/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : undefined;
}

function show(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

const fieldClass =
  "min-w-0 rounded-lg border-2 border-ink/15 bg-white px-2 py-1 text-sm font-bold text-ink focus:border-ink focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-white";

/** A field that keeps what's being typed and saves the parsed number when it's left. */
function NumberField({
  value,
  min,
  max,
  label,
  placeholder,
  className,
  onSave,
}: {
  value: number | undefined;
  min: number;
  max: number;
  label: string;
  placeholder: string;
  className: string;
  onSave: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(show(value));
  const [invalid, setInvalid] = useState(false);
  const save = () => {
    if (text.trim() === "") {
      setInvalid(false);
      if (value !== undefined) onSave(undefined);
      return;
    }
    const parsed = parseNumber(text, min, max);
    setInvalid(parsed === undefined);
    if (parsed !== undefined && parsed !== value) onSave(parsed);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid}
      className={`${fieldClass} ${invalid ? "border-pink-dark" : ""} ${className}`}
    />
  );
}

/** One "期末要考 87 分" line. */
function NeedLine({
  goal,
  label,
  needed,
  remaining,
}: {
  goal: number;
  label: string;
  needed: number | null;
  /** Name of the one item left, or null when several are. */
  remaining: string | null;
}) {
  if (needed === null) return null;
  const text =
    needed > 100
      ? `就算考滿分也到不了 ${goal} 分`
      : needed <= 0
        ? `已經穩過 ${goal} 分了 🎉`
        : remaining
          ? `${remaining}要考 ${Math.ceil(needed)} 分`
          : `剩下的要平均考 ${Math.ceil(needed)} 分`;
  return (
    <p className="text-xs font-black text-ink dark:text-white">
      {label} · <span className={needed > 100 ? "text-pink-dark" : ""}>{text}</span>
    </p>
  );
}

/**
 * 成績計算 for one course: the student's own grade parts and weights, what's earned so far,
 * and what the rest needs to pass or hit a target. An estimate, since teachers adjust grades.
 */
export function GradePanel({ course, passingScore, onChange, onChangePassingScore }: GradePanelProps) {
  const items = course.gradeItems ?? [];
  const [editingPass, setEditingPass] = useState(false);

  const setItems = (next: GradeItem[]) => {
    const updated: Course = { ...course };
    if (next.length > 0) updated.gradeItems = next;
    else delete updated.gradeItems;
    onChange(updated);
  };
  const patchItem = (id: string, patch: Partial<GradeItem>) =>
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (next.score === undefined) delete next.score;
        return next;
      }),
    );

  const addPreset = () =>
    setItems([
      { id: generateId(), name: "平時", weight: 0 },
      { id: generateId(), name: "期中", weight: 0 },
      { id: generateId(), name: "期末", weight: 0 },
    ]);
  const addItem = () => setItems([...items, { id: generateId(), name: "", weight: 0 }]);

  const progress = gradeProgress(items);
  const total = courseScore(course);
  const allScored = items.length > 0 && progress.remainingWeight === 0;
  const unscored = items.filter((item) => item.score === undefined && item.weight > 0);
  const remaining = unscored.length === 1 ? unscored[0].name || "剩下的" : null;

  return (
    <div className="mt-2 rounded-2xl bg-ink/5 px-3 py-2 dark:bg-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-ink dark:text-white">
          成績
          {total !== undefined && <span className="font-bold"> · 學期總成績 {total} 分</span>}
        </p>
        <span className="flex items-center gap-1 text-[11px] font-bold text-ink/60 dark:text-white/60">
          及格線
          {editingPass ? (
            <NumberField
              value={passingScore}
              min={1}
              max={100}
              label="及格線"
              placeholder="60"
              className="w-12 py-0.5 text-xs"
              onSave={(value) => {
                if (value !== undefined) onChangePassingScore(value);
                setEditingPass(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingPass(true)}
              className="-my-1 rounded-full px-1 py-1 font-black underline decoration-2 underline-offset-2"
            >
              {passingScore}
            </button>
          )}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={addPreset}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-black text-lime transition-transform active:scale-95 dark:bg-lime dark:text-ink"
          >
            平時/期中/期末
          </button>
          <button
            type="button"
            onClick={addItem}
            className="rounded-full border-2 border-ink/15 px-3 py-1 text-xs font-black text-ink/70 dark:border-white/20 dark:text-white/70"
          >
            + 自訂項目
          </button>
        </div>
      ) : (
        <>
          <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_4rem_4rem_1.75rem] items-center gap-1.5 text-[10px] font-black text-ink/50 dark:text-white/50">
            <span>項目</span>
            <span>比例 %</span>
            <span>分數</span>
            <span />
          </div>
          <ul className="mt-1 flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_4rem_4rem_1.75rem] items-center gap-1.5">
                <input
                  type="text"
                  defaultValue={item.name}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name !== item.name) patchItem(item.id, { name });
                  }}
                  placeholder="例如 小考"
                  aria-label="成績項目名稱"
                  className={fieldClass}
                />
                <NumberField
                  value={item.weight || undefined}
                  min={0}
                  max={100}
                  label={`${item.name || "這個項目"}的比例`}
                  placeholder="%"
                  className=""
                  onSave={(weight) => patchItem(item.id, { weight: weight ?? 0 })}
                />
                <NumberField
                  value={item.score}
                  min={0}
                  max={150}
                  label={`${item.name || "這個項目"}的分數`}
                  placeholder="未考"
                  className=""
                  onSave={(score) => patchItem(item.id, { score })}
                />
                <button
                  type="button"
                  aria-label={`刪除 ${item.name || "這個項目"}`}
                  onClick={() => setItems(items.filter((other) => other.id !== item.id))}
                  className="grid size-7 place-items-center rounded-full text-sm font-black text-ink/50 hover:bg-pink hover:text-ink dark:text-white/50"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addItem}
            className="-mx-1 mt-1 rounded-full px-1 py-1 text-xs font-black text-ink/70 underline decoration-2 underline-offset-2 dark:text-white/70"
          >
            + 新增項目
          </button>

          {progress.totalWeight !== 100 && progress.totalWeight > 0 && (
            <p className="mt-1 text-[11px] font-bold text-pink-dark">
              比例加起來是 {roundScore(progress.totalWeight)}%,不是 100%
              {progress.totalWeight > 100 ? "(有加分的話沒關係)" : ""}
            </p>
          )}

          <div className="mt-1.5 flex flex-col gap-0.5 border-t-2 border-ink/10 pt-1.5 dark:border-white/10">
            {!allScored && progress.totalWeight > 0 && (
              <p className="text-xs font-bold text-ink/70 dark:text-white/70">
                目前拿到 {roundScore(progress.earned)} 分
              </p>
            )}
            <NeedLine
              goal={passingScore}
              label={`及格 ${passingScore}`}
              needed={scoreNeeded(progress, passingScore)}
              remaining={remaining}
            />
            {course.targetScore !== undefined && (
              <NeedLine
                goal={course.targetScore}
                label={`目標 ${course.targetScore}`}
                needed={scoreNeeded(progress, course.targetScore)}
                remaining={remaining}
              />
            )}
            <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-ink/60 dark:text-white/60">
              目標分數
              <NumberField
                value={course.targetScore}
                min={0}
                max={100}
                label="目標分數"
                placeholder="選填"
                className="w-14 py-0.5 text-xs"
                onSave={(targetScore) => {
                  const updated: Course = { ...course, targetScore };
                  if (targetScore === undefined) delete updated.targetScore;
                  onChange(updated);
                }}
              />
            </span>
            <p className="text-[10px] font-bold text-ink/50 dark:text-white/50">
              照你填的比例估算,老師調分的話以學校成績為準。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
