import type { ExtractionState } from "../../hooks/useScheduleExtraction";
import { EditableCourseList } from "./EditableCourseList";

interface ExtractionResultViewProps {
  state: ExtractionState;
  onSaved: (result: { added: number; skipped: number }) => void;
}

export function ExtractionResultView({ state, onSaved }: ExtractionResultViewProps) {
  if (state.status === "idle") return null;

  if (state.status === "reading" || state.status === "extracting") {
    return (
      <div className="flex items-center gap-3 rounded-3xl border-2 border-ink/10 bg-white p-6 font-bold text-ink dark:border-white/10 dark:bg-white/5 dark:text-white">
        <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-ink border-t-transparent dark:border-white dark:border-t-transparent" />
        <span>{state.status === "reading" ? "讀取檔案中…" : "Claude 辨識課表中,可能需要幾秒鐘…"}</span>
      </div>
    );
  }

  if (state.status === "error") {
    return <div className="rounded-3xl bg-pink p-4 text-sm font-bold text-ink">{state.message}</div>;
  }

  const { courses, warnings } = state.result;

  return (
    <div className="flex flex-col gap-4">
      {warnings && warnings.length > 0 && (
        <div className="rounded-3xl bg-mint p-4 text-sm text-ink">
          <p className="mb-1 font-black">辨識時有些地方不太確定:</p>
          <ul className="list-inside list-disc space-y-0.5 font-bold">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 text-center font-bold text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
          沒有辨識出任何課程,請確認圖片內容是課表
        </div>
      ) : (
        <EditableCourseList result={state.result} onSaved={onSaved} />
      )}

      <details className="rounded-3xl border-2 border-ink/10 bg-white p-4 text-xs dark:border-white/10 dark:bg-white/5">
        <summary className="cursor-pointer font-black text-ink/50 dark:text-white/50">原始辨識 JSON</summary>
        <pre className="mt-2 overflow-x-auto font-mono whitespace-pre-wrap break-all text-ink/70 dark:text-white/70">
          {JSON.stringify(state.result, null, 2)}
        </pre>
      </details>
    </div>
  );
}
