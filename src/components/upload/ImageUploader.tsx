import { useRef, useState, type DragEvent } from "react";

interface ImageUploaderProps {
  onSelect: (file: File) => void;
  previewUrl: string | null;
  isPdf: boolean;
  fileName: string | null;
  disabled: boolean;
}

export function ImageUploader({
  onSelect,
  previewUrl,
  isPdf,
  fileName,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onSelect(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={disabled ? undefined : handleDrop}
      className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-[3px] border-dashed p-8 text-center transition-colors ${
        isDragging
          ? "border-ink bg-lime dark:border-lime"
          : "border-ink/25 hover:border-ink dark:border-white/25 dark:hover:border-white"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />

      {previewUrl ? (
        <img src={previewUrl} alt="課表預覽" className="max-h-56 rounded-2xl border-2 border-ink object-contain" />
      ) : isPdf && fileName ? (
        <div className="flex flex-col items-center gap-2 text-ink dark:text-white">
          <span className="text-4xl">📄</span>
          <span className="text-sm font-bold">{fileName}</span>
        </div>
      ) : (
        <>
          <span className="text-4xl">🖼️</span>
          <p className="text-sm font-black text-ink dark:text-white">點擊或拖曳課表圖片到這裡</p>
          <p className="text-xs font-bold text-ink/40 dark:text-white/40">
            支援 JPEG / PNG / GIF / WebP / PDF
          </p>
        </>
      )}
    </div>
  );
}
