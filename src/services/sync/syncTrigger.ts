/**
 * Zero-dependency debounced pub-sub. Storage repositories call `requestSync()`
 * without knowing anything about Firebase or merge logic — this keeps their
 * import graph a leaf, so `cloudSync.ts` (which DOES need to call back into
 * the repositories to apply merges) can depend on them without a cycle.
 */
export type SyncKind = "schedule" | "settings";

const DEBOUNCE_MS = 1500;

let handler: ((kind: SyncKind) => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pendingKinds = new Set<SyncKind>();

function flush(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pendingKinds.size === 0 || !handler) return;
  const kinds = pendingKinds;
  pendingKinds = new Set();
  for (const kind of kinds) handler(kind);
}

export function onSyncRequested(callback: (kind: SyncKind) => void): void {
  handler = callback;
}

export function requestSync(kind: SyncKind): void {
  pendingKinds.add(kind);
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}
