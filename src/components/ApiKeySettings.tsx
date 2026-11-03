import { useState } from "react";
import { clearActiveApiKey, hasActiveStoredApiKey, setActiveApiKey } from "../services/ai";

export function ApiKeySettings() {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(() => hasActiveStoredApiKey());
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyFlash, setKeyFlash] = useState<string | null>(null);

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setActiveApiKey(trimmed);
    setApiKeyInput("");
    setHasKey(true);
    setIsEditingKey(false);
    setKeyFlash("已儲存");
    setTimeout(() => setKeyFlash(null), 2000);
  };

  const handleClearKey = () => {
    clearActiveApiKey();
    setHasKey(false);
    setKeyFlash("已清除,將改用 .env 的設定(如果有的話)");
    setTimeout(() => setKeyFlash(null), 3000);
  };

  const showKeyForm = !hasKey || isEditingKey;

  return (
    <>
      {showKeyForm ? (
        <>
          <p className="text-xs font-bold opacity-70">
            Key 只存在你這個瀏覽器的 localStorage,不會上傳到任何伺服器。這裡設定的話會優先於專案的
            .env 設定,適合你以後把這個 app 部署給別人用的情況——每個人用自己的 key,不會共用你的額度。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="sk-ant-..."
              className="min-w-0 flex-1 rounded-xl border-2 border-ink/20 bg-white px-3 py-1.5 text-sm font-bold text-ink focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={!apiKeyInput.trim()}
              className="rounded-full bg-ink px-4 py-2 text-sm font-black text-sky transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              儲存
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingKey(false);
                  setApiKeyInput("");
                }}
                className="rounded-full px-4 py-2 text-sm font-black text-ink/70 hover:text-ink"
              >
                取消
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 text-sm font-black">
          <span>已設定 API key</span>
          <button
            type="button"
            onClick={() => setIsEditingKey(true)}
            className="underline decoration-2 underline-offset-2"
          >
            更換
          </button>
          <button type="button" onClick={handleClearKey} className="text-ink/70 underline hover:text-ink">
            清除
          </button>
        </div>
      )}
      {keyFlash && <p className="text-sm font-black">{keyFlash}</p>}
    </>
  );
}
