import { useState } from "react";
import type { Course } from "../schema/course";
import { blankCourseDraft, draftsToCourses, validateDraft } from "../schema/mapExtraction";
import { addCourses, loadSchedule } from "../services/storage/scheduleRepository";
import { CourseDraftForm } from "../components/CourseDraftForm";
import { ScanSection } from "../components/upload/ScanSection";

export type AddCourseMode = "manual" | "scan";

const MODES: Record<AddCourseMode, { title: string; intro: string; cardClass: string }> = {
  manual: {
    title: "手動輸入",
    intro: "一次填一堂,存好會清空,方便接著填下一堂。",
    cardClass: "bg-lime",
  },
  scan: {
    title: "掃描圖片",
    intro: "需要先在 設定 › API Key 貼上自己的 key。",
    cardClass: "bg-sky",
  },
};

interface AddCoursePageProps {
  /** Skips the method picker, e.g. when arriving from an empty-state button. */
  initialMode: AddCourseMode | null;
  onNavigateHome: () => void;
  onNavigateManage: () => void;
}

export function AddCoursePage({ initialMode, onNavigateHome, onNavigateManage }: AddCoursePageProps) {
  const [mode, setMode] = useState<AddCourseMode | null>(initialMode);

  if (mode === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">新增課程</h1>
          <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">選一種方式把課加進來。</p>
        </header>

        <div className="flex flex-col gap-3">
          {(Object.keys(MODES) as AddCourseMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex items-center justify-between gap-4 rounded-3xl ${MODES[key].cardClass} p-5 text-left text-ink transition-transform active:scale-[0.98]`}
            >
              <span className="text-xl font-black">{MODES[key].title}</span>
              <span aria-hidden="true" className="text-2xl font-black">
                ›
              </span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => setMode(null)}
          className="-my-2 -ml-2 rounded-full px-2 py-2 text-sm font-black text-ink dark:text-white"
        >
          ‹ 新增課程
        </button>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">{MODES[mode].title}</h1>
        <p className="text-sm font-bold text-ink/60 dark:text-white/60">{MODES[mode].intro}</p>
      </header>

      {mode === "manual" ? (
        <ManualEntry onNavigateManage={onNavigateManage} />
      ) : (
        <ScanSection onNavigateHome={onNavigateHome} />
      )}
    </main>
  );
}

function ManualEntry({ onNavigateManage }: { onNavigateManage: () => void }) {
  const [courses, setCourses] = useState<Course[]>(() => loadSchedule().courses);
  const [draft, setDraft] = useState(blankCourseDraft);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const save = () => {
    if (validateDraft(draft)) return;
    try {
      const result = addCourses(draftsToCourses([draft]));
      if (result.addedCount === 0) return;
      setCourses(result.schedule.courses);
      setLastAdded(draft.name.trim());
      setDraft(blankCourseDraft());
      setStorageError(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "儲存失敗");
    }
  };

  return (
    <>
      {lastAdded && (
        <div className="rounded-3xl bg-lime p-5 text-ink">
          <p className="font-black">
            已新增「{lastAdded}」,目前共 {courses.length} 堂課。
          </p>
          <button
            type="button"
            onClick={onNavigateManage}
            className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-black text-lime transition-transform active:scale-95"
          >
            查看所有課程
          </button>
        </div>
      )}

      {storageError && (
        <div className="rounded-3xl bg-pink p-4 text-sm font-bold text-ink">{storageError}</div>
      )}

      {/* Keyed by draft so each fresh form remounts and puts the cursor back in the name field. */}
      <CourseDraftForm
        key={draft.localId}
        draft={draft}
        onChange={setDraft}
        onSave={save}
        existingCourses={courses}
      />
    </>
  );
}
