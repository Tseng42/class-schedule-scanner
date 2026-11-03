import { useState } from "react";
import { currentNotificationState, type NotificationState } from "../lib/settingsStatus";
import { formatDuration } from "../services/scheduling/nextClass";

function isStandaloneDisplayMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

interface BrowserNotificationSettingsProps {
  reminderMinutes: number;
}

export function BrowserNotificationSettings({ reminderMinutes }: BrowserNotificationSettingsProps) {
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
    </>
  );
}
