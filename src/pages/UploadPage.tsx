import { useState } from "react";
import { ImageUploader } from "../components/upload/ImageUploader";
import { ExtractionResultView } from "../components/upload/ExtractionResultView";
import { useImageUpload } from "../hooks/useImageUpload";
import { useScheduleExtraction } from "../hooks/useScheduleExtraction";

interface UploadPageProps {
  onNavigateHome: () => void;
}

export function UploadPage({ onNavigateHome }: UploadPageProps) {
  const { uploaded, error: uploadError, selectFile, reset: resetUpload } = useImageUpload();
  const { state, run, reset: resetExtraction } = useScheduleExtraction();
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const isBusy = state.status === "reading" || state.status === "extracting";

  const handleSelect = (file: File) => {
    selectFile(file);
    resetExtraction();
    setSavedCount(null);
    void run(file);
  };

  const handleReset = () => {
    resetUpload();
    resetExtraction();
    setSavedCount(null);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink dark:text-white">課表掃描</h1>
        <p className="mt-1 text-sm font-bold text-ink/50 dark:text-white/50">
          上傳課表截圖或 PDF,讓 Claude 幫你辨識成結構化課表。
        </p>
      </header>

      <ImageUploader
        onSelect={handleSelect}
        previewUrl={uploaded?.previewUrl ?? null}
        isPdf={uploaded?.isPdf ?? false}
        fileName={uploaded?.file.name ?? null}
        disabled={isBusy}
      />

      {uploadError && (
        <div className="rounded-3xl bg-pink p-4 text-sm font-bold text-ink">{uploadError}</div>
      )}

      {savedCount !== null ? (
        <div className="rounded-3xl bg-lime p-5 text-ink">
          <p className="font-black">已儲存 {savedCount} 堂課到這個瀏覽器,重新整理也不會不見。</p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-black text-lime transition-transform active:scale-95"
          >
            查看今天課表
          </button>
        </div>
      ) : (
        <ExtractionResultView state={state} onSaved={setSavedCount} />
      )}

      {uploaded && !isBusy && (
        <button
          type="button"
          onClick={handleReset}
          className="self-start rounded-full border-2 border-ink/20 px-4 py-2 text-sm font-black text-ink/60 transition-colors hover:border-ink hover:text-ink dark:border-white/20 dark:text-white/60 dark:hover:border-white dark:hover:text-white"
        >
          重新上傳
        </button>
      )}
    </main>
  );
}
