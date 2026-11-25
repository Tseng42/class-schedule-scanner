import { useState } from "react";
import { currentNotificationState, type NotificationState } from "../lib/settingsStatus";
import { formatDuration } from "../services/scheduling/nextClass";
import { isAppBadgeSupported } from "../services/notifications/appBadge";
import type { AppSettings } from "../schema/settings";

function isStandaloneDisplayMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

interface BrowserNotificationSettingsProps {
  settings: AppSettings;
  /** Called with the full updated settings; the parent persists them. */
  onChange: (next: AppSettings) => void;
}

export function BrowserNotificationSettings({ settings, onChange }: BrowserNotificationSettingsProps) {
  const reminderMinutes = settings.reminderMinutes;
  const [notificationState, setNotificationState] = useState<NotificationState>(currentNotificationState);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [standalone] = useState(() => isStandaloneDisplayMode());
  const [ios] = useState(() => isIos());

  const handleEnableNotifications = async () => {
    setNotificationError(null);
    if (typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      if (permission !== "granted") {
        setNotificationError(
          ios && !standalone
            ? "沒有跳出授權視窗——iPhone 上一定要先「加入主畫面」變成獨立 App,在 Safari 分頁裡是不會跳的"
            : "你剛剛沒有允許通知",
        );
      }
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "請求通知權限時發生錯誤");
    }
  };

  return (
    <>
      <p className="text-xs font-bold opacity-70">
        只在這個網頁開著的時候才會準時跳出來,分頁關掉或瀏覽器背景太久都可能失效,不是可靠的提醒方式。
      </p>
      {ios && (
        <p className="text-xs font-black opacity-70">
          目前開啟方式:{standalone ? "獨立 App(已加到主畫面)" : "Safari 分頁——iPhone 通知必須先加到主畫面才能用"}
        </p>
      )}
      {notificationState === "unsupported" ? (
        <p className="text-sm font-bold opacity-70">這個瀏覽器不支援通知功能</p>
      ) : notificationState === "granted" ? (
        <p className="text-sm font-black">已開啟,上課前 {formatDuration(reminderMinutes * 60000)}會提醒你</p>
      ) : notificationState === "denied" ? (
        <p className="text-sm font-bold opacity-70">已被封鎖,如果想開啟,請到瀏覽器的網站設定裡手動允許通知</p>
      ) : (
        <button
          type="button"
          onClick={() => void handleEnableNotifications()}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-black text-mint transition-transform active:scale-95"
        >
          開啟瀏覽器提醒
        </button>
      )}
      {notificationError && <p className="card-error text-sm font-bold">{notificationError}</p>}

      <div className="flex flex-col gap-2 border-t-2 border-ink/10 pt-4">
        <label className="flex items-start gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={settings.appBadge !== false}
            onChange={(event) => onChange({ ...settings, appBadge: event.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span>App 圖示顯示紅色數字(今天到期和逾期、還沒打勾的作業)</span>
        </label>
        <p className="text-xs font-bold opacity-70">
          {isAppBadgeSupported()
            ? "數字只在打開 App 的時候更新,App 關著時會停在最後一次打開的數字。"
            : "這個瀏覽器不支援 App 圖示數字。"}
          iPhone 要 iOS 16.4 以上、加到主畫面,而且要先開啟上面的通知才會出現;Android 不支援數字。
        </p>
      </div>
    </>
  );
}
