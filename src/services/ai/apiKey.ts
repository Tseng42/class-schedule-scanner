const LOCAL_STORAGE_KEY = "class-schedule-scanner:apiKey";

/**
 * Resolution order: a key the user pasted into Settings (their own browser's
 * localStorage — never bundled, never sent anywhere but Anthropic) first,
 * then the local-dev `.env` value as a fallback. Keeping this indirection
 * from day one means adding a Settings UI later doesn't require touching
 * every call site that reads the key.
 */
export function getApiKey(): string | undefined {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) return stored;
  return import.meta.env.VITE_ANTHROPIC_API_KEY;
}

export function setApiKey(key: string): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function hasStoredApiKey(): boolean {
  return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
}
