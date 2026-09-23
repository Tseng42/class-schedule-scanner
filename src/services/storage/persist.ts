/** Thrown when writing to localStorage fails — quota exceeded, or private/incognito mode in some browsers. */
export class StorageWriteError extends Error {
  constructor(cause: unknown) {
    super("儲存失敗,瀏覽器儲存空間可能已滿,或目前處於無痕/隱私瀏覽模式");
    this.name = "StorageWriteError";
    this.cause = cause;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new StorageWriteError(error);
  }
}
