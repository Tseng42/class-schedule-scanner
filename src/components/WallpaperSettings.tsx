import { useEffect, useState } from "react";
import type { Schedule } from "../schema/schedule";
import type { AppSettings } from "../schema/settings";
import {
  hasWeeklyClasses,
  renderWallpaperCanvas,
  shareWallpaper,
  wallpaperSize,
  type WallpaperStyle,
} from "../services/share/wallpaperCard";

interface WallpaperSettingsProps {
  schedule: Schedule;
  settings: AppSettings;
}

const STYLES: { id: WallpaperStyle; label: string }[] = [
  { id: "light", label: "淺色" },
  { id: "dark", label: "深色" },
];

/** 設定 › 課表桌布: pick light or dark, see it, save it to set as the lock screen by hand. */
export function WallpaperSettings({ schedule, settings }: WallpaperSettingsProps) {
  const [style, setStyle] = useState<WallpaperStyle>("dark");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const hasClasses = hasWeeklyClasses(schedule);
  const [size] = useState(wallpaperSize);

  useEffect(() => {
    if (!hasClasses) return;
    try {
      setPreview(renderWallpaperCanvas(schedule, settings, style, size).toDataURL("image/png"));
    } catch {
      setPreview(null);
    }
  }, [schedule, settings, style, hasClasses, size]);

  if (!hasClasses) {
    return <p className="text-sm font-bold opacity-70">還沒有每週固定上的課。先新增課程,才能做課表桌布。</p>;
  }

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await shareWallpaper(schedule, settings, style);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "產生桌布失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        把每週固定的課做成一張鎖定畫面桌布,上面留給時鐘和小工具。放假、停課和只上一次的課不會畫上去。
      </p>

      <div className="flex gap-2" role="radiogroup" aria-label="桌布顏色">
        {STYLES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={style === option.id}
            onClick={() => setStyle(option.id)}
            className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-black transition-transform active:scale-95 ${
              style === option.id ? "bg-ink text-lime" : "bg-white text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preview && (
        <img
          src={preview}
          alt={`課表桌布預覽(${style === "dark" ? "深色" : "淺色"})`}
          className="mx-auto w-48 rounded-[1.75rem] border-4 border-ink shadow-lg"
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        />
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSave()}
        className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-lime transition-transform active:scale-95 disabled:opacity-50"
      >
        {busy ? "產生中…" : "存成桌布"}
      </button>
      {error && <p className="card-error text-sm font-bold">{error}</p>}

      <div className={`rounded-2xl bg-white px-4 py-3 text-xs font-bold ${saved ? "ring-2 ring-ink" : ""}`}>
        <p className="font-black">{saved ? "存好了,接著這樣換:" : "存好之後這樣換:"}</p>
        <p className="mt-1">iPhone:在分享選單選「儲存影像」,再到「設定 › 桌布 › 加入新桌布 › 照片」選這張。</p>
        <p className="mt-1">Android:在相簿打開這張,選「設為桌布 › 鎖定畫面」(各家選單名稱略有不同)。</p>
      </div>
      <p className="text-xs font-bold opacity-70">
        圖片照這支手機的螢幕大小做({size.width}×{size.height})。換手機或課表有改,要回來重新存一次。
      </p>
    </>
  );
}
