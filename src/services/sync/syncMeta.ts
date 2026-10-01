const STORAGE_KEY = "class-schedule-scanner:syncMeta";

interface SyncMeta {
  /** Set only by a completed syncNow() call — doubles as the "last synced at" value shown in Settings. */
  lastReconcileAt?: string;
  lastKnownCloudScheduleUpdatedAt?: string;
  lastKnownCloudSettingsUpdatedAt?: string;
}

function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as SyncMeta) : {};
  } catch {
    return {};
  }
}

function writeMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Sync metadata is best-effort bookkeeping — a write failure here must not break sync itself.
  }
}

export function getSyncMeta(): SyncMeta {
  return readMeta();
}

export function updateSyncMeta(patch: Partial<SyncMeta>): void {
  writeMeta({ ...readMeta(), ...patch });
}
