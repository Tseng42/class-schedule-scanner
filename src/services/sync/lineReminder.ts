import { getCurrentUser } from "./googleAuth";

export interface LineTestResult {
  ok: boolean;
  message: string;
}

/** Asks the server (api/line-test.js) to push a test message to the owner's LINE. */
export async function sendLineTestMessage(): Promise<LineTestResult> {
  const user = getCurrentUser();
  if (!user) return { ok: false, message: "請先登入雲端同步" };

  let response: Response;
  try {
    const idToken = await user.getIdToken();
    response = await fetch("/api/line-test", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
  } catch {
    return { ok: false, message: "連不上伺服器,請確認網路後再試一次" };
  }

  // The local dev server has no /api and answers with the app's HTML instead.
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, message: "這裡沒有提醒伺服器,請到正式網站上測試" };
  }
  const body: unknown = await response.json().catch(() => null);
  const message =
    typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
      ? body.message
      : `伺服器回應異常(${response.status})`;
  return { ok: response.ok, message };
}
