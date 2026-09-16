import { claudeVisionExtractor } from "./claudeVisionExtractor";
import type { ScheduleExtractor } from "./ScheduleExtractor";

export const scheduleExtractor: ScheduleExtractor = claudeVisionExtractor;

export type { ScheduleExtractor, UploadedFileKind } from "./ScheduleExtractor";
export { MissingApiKeyError, RefusalError } from "./errors";
export {
  getApiKey as getActiveApiKey,
  setApiKey as setActiveApiKey,
  clearApiKey as clearActiveApiKey,
  hasStoredApiKey as hasActiveStoredApiKey,
} from "./apiKey";
