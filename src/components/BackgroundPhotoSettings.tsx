import { useEffect, useRef, useState } from "react";
import { useBackgroundPhotoUrl } from "../hooks/useBackgroundPhotoUrl";
import { compressPhoto, removeBackgroundPhoto, saveBackgroundPhoto } from "../services/storage/backgroundPhoto";

interface BackgroundPhotoSettingsProps {
  /** Tells the settings list whether a photo is set now. */
  onChange: (hasPhoto: boolean) => void;
}

export function BackgroundPhotoSettings({ onChange }: BackgroundPhotoSettingsProps) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickButtonRef = useRef<HTMLButtonElement>(null);
  const refocusAfterRemove = useRef(false);
  const photoUrl = useBackgroundPhotoUrl(version);

  // The remove button disappears with the photo; once it's gone and the pick button
  // is enabled again, put keyboard focus there instead of losing it to the page.
  useEffect(() => {
    if (refocusAfterRemove.current && !photoUrl && !busy) {
      refocusAfterRemove.current = false;
      pickButtonRef.current?.focus();
    }
  }, [photoUrl, busy]);

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await saveBackgroundPhoto(await compressPhoto(file));
      setVersion((value) => value + 1);
      onChange(true);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : "照片設定失敗");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeBackgroundPhoto();
      setVersion((value) => value + 1);
      onChange(false);
      refocusAfterRemove.current = true;
    } catch {
      setError("移除失敗,再試一次");
    } finally {
      setBusy(false);
    }
  };

  const buttonClass =
    "rounded-full border-2 border-ink px-4 py-2.5 text-sm font-black text-ink transition-transform active:scale-95 disabled:opacity-50";

  return (
    <>
      {photoUrl ? (
        <div className="relative h-40 overflow-hidden rounded-2xl border-2 border-ink">
          <img src={photoUrl} alt="目前的課表背景照片" className="absolute inset-0 size-full object-cover" />
          {/* Same veil the timetable puts over the photo, so this is what it will look like. */}
          <div aria-hidden="true" className="absolute inset-0 bg-white/70" />
          <p className="absolute inset-x-0 bottom-0 p-3 text-xs font-black">預覽:課表上大概是這樣(暗色模式會更暗)</p>
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-ink/30 bg-white/60 p-4 text-sm font-bold">還沒有設定照片</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handlePick(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <button
          ref={pickButtonRef}
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={`${buttonClass} bg-white`}
        >
          {busy ? "處理中…" : photoUrl ? "換一張" : "選擇照片"}
        </button>
        {photoUrl && (
          <button type="button" disabled={busy} onClick={() => void handleRemove()} className={buttonClass}>
            移除照片
          </button>
        )}
      </div>
      {error && <p className="card-error text-sm font-bold">{error}</p>}
      <p className="text-xs font-bold opacity-70">
        照片只鋪在週課表的格子裡,上面會蓋一層半透明遮罩,課名和時間都看得清楚。照片會壓縮後只存在這支手機,不會上傳,也不會同步到其他裝置。
      </p>
    </>
  );
}
