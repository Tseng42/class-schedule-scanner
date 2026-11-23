/**
 * The timetable's background photo. It lives only on this device, in IndexedDB
 * (localStorage holds a few MB of strings at most), and is never synced or uploaded.
 * Stored as bytes rather than a Blob, which older iOS Safari couldn't keep in IndexedDB.
 */

const DB_NAME = "class-schedule-scanner";
const STORE = "files";
const KEY = "timetable-background";
/** Long edge after compression: sharp on a phone at 2–3× while staying a few hundred KB. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

interface StoredPhoto {
  type: string;
  data: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function loadBackgroundPhoto(): Promise<Blob | null> {
  try {
    const stored = (await withStore("readonly", (store) => store.get(KEY))) as StoredPhoto | undefined;
    return stored ? new Blob([stored.data], { type: stored.type }) : null;
  } catch {
    return null;
  }
}

export async function hasBackgroundPhoto(): Promise<boolean> {
  try {
    return (await withStore("readonly", (store) => store.count(KEY))) > 0;
  } catch {
    return false;
  }
}

export async function saveBackgroundPhoto(photo: Blob): Promise<void> {
  const stored: StoredPhoto = { type: photo.type, data: await photo.arrayBuffer() };
  try {
    await withStore("readwrite", (store) => store.put(stored, KEY));
  } catch {
    throw new Error("照片存不進去,手機的儲存空間可能不夠,或正在用無痕模式");
  }
}

export async function removeBackgroundPhoto(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(KEY));
}

/** Shrinks a picked photo to MAX_EDGE and re-encodes it as JPEG. */
export async function compressPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("讀不到這張照片,換一張試試看");
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("這個瀏覽器沒辦法處理照片");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("照片壓縮失敗,換一張試試看"))),
        "image/jpeg",
        JPEG_QUALITY,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
