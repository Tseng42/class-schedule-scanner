import { useCallback, useEffect, useRef, useState } from "react";

const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export interface UploadedFile {
  file: File;
  previewUrl: string | null; // null for PDFs — no image preview
  isPdf: boolean;
}

export function useImageUpload() {
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const selectFile = useCallback((file: File) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError("請上傳 JPEG、PNG、GIF、WebP 圖片或 PDF 檔案");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    const isPdf = file.type === "application/pdf";
    const previewUrl = isPdf ? null : URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;

    setError(null);
    setUploaded({ file, previewUrl, isPdf });
  }, []);

  const reset = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setUploaded(null);
    setError(null);
  }, []);

  return { uploaded, error, selectFile, reset };
}
