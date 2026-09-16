import type { ExtractionResult } from "../../schema/extraction";

export type UploadedFileKind = "image" | "pdf";

export interface ScheduleExtractor {
  extract(base64Data: string, kind: UploadedFileKind, mimeType: string): Promise<ExtractionResult>;
}
