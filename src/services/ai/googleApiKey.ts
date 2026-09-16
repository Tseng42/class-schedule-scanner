const LOCAL_STORAGE_KEY = "class-schedule-scanner:googleApiKey";

/**
 * Same resolution order as apiKey.ts (localStorage first, then `.env`) —
 * kept as its own small file rather than a shared factory since each
 * provider owns its key naming independently.
 */
export function getGoogleApiKey(): string | undefined {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) return stored;
  return import.meta.env.VITE_GOOGLE_API_KEY;
}

export function setGoogleApiKey(key: string): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, key);
}

export function clearGoogleApiKey(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function hasStoredGoogleApiKey(): boolean {
  return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
}
