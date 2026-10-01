import { useEffect, useRef, useState, type ReactNode } from "react";
import { isSyncConfigured } from "../services/sync/firebaseConfig";
import { onAuthStateChange, resolveRedirectResult } from "../services/sync/googleAuth";
import { syncNow, type SyncResult } from "../services/sync/cloudSync";

const BOOT_SYNC_TIMEOUT_MS = 7000;
const NOTICE_DURATION_MS = 4000;

function timeoutFallback(ms: number): Promise<SyncResult> {
  return new Promise((resolve) => setTimeout(() => resolve({ action: "noop" }), ms));
}

function noticeFor(result: SyncResult): string | null {
  const { scheduleAddedCount = 0, holidayAddedCount = 0 } = result;
  if (scheduleAddedCount === 0 && holidayAddedCount === 0) return null;
  const parts: string[] = [];
  if (scheduleAddedCount > 0) parts.push(`${scheduleAddedCount} 堂課`);
  if (holidayAddedCount > 0) parts.push(`${holidayAddedCount} 個放假日`);
  return `已從雲端合併 ${parts.join("、")}`;
}

interface SyncGateProps {
  children: ReactNode;
}

/**
 * Blocks initial render only long enough to reconcile with the cloud once at
 * boot (and only when signed in) — this guarantees every page's one-shot
 * `useState(() => loadSchedule())` read already sees post-sync data, without
 * retrofitting any page with reactive listeners. A stalled/offline check
 * always falls through to rendering with whatever is in localStorage already;
 * sync is strictly additive and must never hard-block the app.
 */
export function SyncGate({ children }: SyncGateProps) {
  const [ready, setReady] = useState(!isSyncConfigured);
  const [notice, setNotice] = useState<string | null>(null);
  const didInit = useRef(false);

  const flashNotice = (result: SyncResult) => {
    const message = noticeFor(result);
    if (!message) return;
    setNotice(message);
    setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
  };

  useEffect(() => {
    if (!isSyncConfigured || didInit.current) return;
    didInit.current = true;

    void (async () => {
      await resolveRedirectResult();
      const unsubscribe = onAuthStateChange((user) => {
        unsubscribe();
        if (!user) {
          setReady(true);
          return;
        }
        void Promise.race([syncNow(), timeoutFallback(BOOT_SYNC_TIMEOUT_MS)]).then((result) => {
          flashNotice(result);
          setReady(true);
        });
      });
    })();
  }, []);

  // iOS backgrounds this PWA rather than killing it, so re-check quietly
  // whenever it's brought back to the foreground — never blocks rendering.
  useEffect(() => {
    if (!isSyncConfigured) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void syncNow().then(flashNotice);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream dark:bg-ink">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/15 border-t-ink dark:border-white/15 dark:border-t-white" />
      </div>
    );
  }

  return (
    <>
      {children}
      {notice && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-full bg-ink px-5 py-2.5 text-center text-sm font-black text-mint shadow-lg dark:bg-mint dark:text-ink">
          {notice}
        </div>
      )}
    </>
  );
}
