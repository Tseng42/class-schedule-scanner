import {
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  BadRequestError,
  APIConnectionError,
} from "@anthropic-ai/sdk";
import { useCallback, useState } from "react";
import { scheduleExtractor, MissingApiKeyError, RefusalError } from "../services/ai";
import type { ExtractionResult } from "../schema/extraction";

export type ExtractionState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "extracting" }
  | { status: "success"; result: ExtractionResult }
  | { status: "error"; message: string };

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.slice(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("讀取檔案失敗"));
    reader.readAsDataURL(file);
  });
}

function describeError(error: unknown): string {
  if (error instanceof MissingApiKeyError) {
    return "尚未設定 API key,請在專案根目錄的 .env 檔設定 VITE_ANTHROPIC_API_KEY 後重新啟動";
  }
  if (error instanceof RefusalError) {
    return "模型拒絕處理這個請求,請換一張圖片再試";
  }
  if (error instanceof AuthenticationError) {
    return "API key 無效,請檢查設定";
  }
  if (error instanceof PermissionDeniedError) {
    return "此 API key 無權限使用此模型";
  }
  if (error instanceof RateLimitError) {
    return "請求太頻繁,請稍後再試";
  }
  if (error instanceof BadRequestError) {
    return "圖片無法處理,請確認格式或縮小檔案大小";
  }
  if (error instanceof APIConnectionError) {
    return "網路連線失敗,請重試";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "發生未知錯誤";
}

export function useScheduleExtraction() {
  const [state, setState] = useState<ExtractionState>({ status: "idle" });

  const run = useCallback(async (file: File) => {
    setState({ status: "reading" });
    try {
      const base64Data = await readFileAsBase64(file);
      const kind = file.type === "application/pdf" ? "pdf" : "image";

      setState({ status: "extracting" });
      const result = await scheduleExtractor.extract(base64Data, kind, file.type);
      setState({ status: "success", result });
    } catch (error) {
      setState({ status: "error", message: describeError(error) });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset };
}
