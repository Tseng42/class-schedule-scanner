import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isSyncConfigured } from "../services/sync/firebaseConfig";
import { getCurrentUser, onAuthStateChange, signInWithGoogle, signOutUser } from "../services/sync/googleAuth";
import { syncNow } from "../services/sync/cloudSync";
import { getSyncMeta } from "../services/sync/syncMeta";

function formatSyncedAt(iso: string | undefined): string {
  if (!iso) return "尚未同步過";
  return new Date(iso).toLocaleString("zh-TW", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CloudSyncSettings() {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(() => getSyncMeta().lastReconcileAt);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => onAuthStateChange(setUser), []);

  if (!isSyncConfigured) return null;

  const handleSignIn = () => {
    setError(null);
    signInWithGoogle();
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOutUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登出失敗");
    }
  };

  const handleSyncNow = async () => {
    setError(null);
    setSyncing(true);
    try {
      await syncNow();
      setLastSyncedAt(getSyncMeta().lastReconcileAt);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失敗");
    } finally {
      setSyncing(false);
    }
  };

  if (!user) {
    return (
      <>
        <p className="text-xs font-bold opacity-70">
          用 Google 帳號登入後,課表和設定會自動同步到雲端,換裝置或重新整理也不會不見。登入一次之後會一直保持登入。
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95"
        >
          使用 Google 帳號同步
        </button>
        {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      </>
    );
  }

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        已用 <span className="font-black">{user.email}</span> 同步。上次同步:{formatSyncedAt(lastSyncedAt)}。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSyncNow()}
          disabled={syncing}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? "同步中…" : "立即同步"}
        </button>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="rounded-full border-2 border-ink px-5 py-2.5 text-sm font-black text-ink transition-transform active:scale-95 dark:border-white dark:text-white"
        >
          登出
        </button>
      </div>
      <p className="text-xs font-bold opacity-50">登出不會刪除這台裝置上的課表,只是不再跟雲端同步。</p>
      {flash && <p className="text-sm font-black">已同步</p>}
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
    </>
  );
}
