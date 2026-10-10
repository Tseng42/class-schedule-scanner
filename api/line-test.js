// @ts-check
import { bearerToken, missingEnv } from "./_lib/env.js";
import { checkOwnerToken } from "./_lib/firebaseAdmin.js";
import { pushText } from "./_lib/line.js";

const REQUIRED_ENV = ["FIREBASE_SERVICE_ACCOUNT", "LINE_OWNER_EMAIL", "LINE_CHANNEL_ACCESS_TOKEN", "LINE_USER_ID"];

/**
 * The "發送測試訊息" button in Settings. Authenticated with the caller's
 * Firebase ID token, and only the configured owner account may trigger it —
 * otherwise any signed-in visitor could spend the LINE message quota.
 *
 * @param {import("./_lib/env.js").ApiRequest} request
 * @param {import("./_lib/env.js").ApiResponse} response
 */
export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length > 0) {
    return response
      .status(503)
      .json({ ok: false, message: `伺服器還沒設定好 LINE 提醒,Vercel 缺少環境變數:${missing.join("、")}` });
  }

  const idToken = bearerToken(request.headers.authorization);
  if (!idToken) return response.status(401).json({ ok: false, message: "請先登入雲端同步" });

  try {
    const check = await checkOwnerToken(idToken);
    if (check === "invalid") {
      return response.status(401).json({
        ok: false,
        message: "登入驗證沒通過:請重新登入雲端同步;如果還是一樣,檢查 FIREBASE_SERVICE_ACCOUNT 是不是同一個 Firebase 專案的金鑰",
      });
    }
    if (check === "not-owner") {
      return response
        .status(403)
        .json({ ok: false, message: "目前登入的 Google 帳號跟 Vercel 上 LINE_OWNER_EMAIL 設定的不一樣" });
    }

    const result = await pushText("課表提醒測試訊息\nLINE 已經接上了,之後的提醒會傳到這裡。");
    if (!result.ok) {
      return response
        .status(502)
        .json({ ok: false, message: `LINE 回報錯誤(${result.status || "連線失敗"}):${result.message}` });
    }
    return response.status(200).json({ ok: true, message: "已送出,去 LINE 看看有沒有收到" });
  } catch (error) {
    console.error("line-test failed", error);
    return response.status(500).json({ ok: false, message: "伺服器發生錯誤,可能是 FIREBASE_SERVICE_ACCOUNT 的內容不正確" });
  }
}
