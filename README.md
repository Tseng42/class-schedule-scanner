# 課表掃描與上課提醒

上傳課表截圖或 PDF,用 Claude Vision API 辨識成結構化課表,並提供上課提醒(瀏覽器通知 + .ics 行事曆匯出)。純前端 SPA,資料預設只存在瀏覽器 localStorage——可選擇性地用 Firebase 開啟跨裝置雲端同步(見下方「雲端同步設定」),不開啟的話完全不需要任何後端伺服器。

## 開始使用

```bash
npm install
cp .env.example .env
```

編輯 `.env`,填入你的 Anthropic API key(到 https://console.anthropic.com 申請,需要先儲值美金額度):

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

**⚠️ 絕對不要把 `.env` commit 進 git。** `.gitignore` 已經排除它,但如果你手動 `git add -A` 或改動 `.gitignore`,務必再三檢查不要把真實的 key 推上去。如果這個 app 之後要公開部署給其他人用,`.env` 裡的 key 會被打包進前端程式碼,任何訪客都能從瀏覽器開發工具偷走——屆時請改用設定頁裡「使用者自行輸入 API key」的功能(存在使用者自己瀏覽器的 localStorage),不要用共用的 `.env` key。

```bash
npm run dev
```

## 雲端同步設定(選用)

不設定的話 app 完全正常運作,只是資料不會跨裝置同步(跟現在一樣)。要開啟手機/電腦跨裝置同步:

1. 到 [Firebase 主控台](https://console.firebase.google.com) 建立一個新專案(免費方案就夠用)。
2. **Authentication** → 開始使用 → 登入方式 → 啟用「Google」。
3. **Firestore Database** → 建立資料庫(正式環境模式即可,下一步會設定規則)。
4. **Firestore Database → 規則**,貼上專案根目錄 `firestore.rules` 的內容並發布。
5. 專案設定(齒輪圖示)→ 一般 → 新增一個「Web」應用程式,複製畫面上給的設定值,填進 `.env`(本機測試)和 Vercel 專案的環境變數(正式上線):
   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_APP_ID=
   ```
   這四個值**不是機密**——Firebase 的用戶端設定本來就設計成會進前端程式碼、任何人看得到也沒關係,真正的存取控制是第 4 步設定的 Firestore 規則(只有登入者本人能讀寫自己的資料)。跟上面的 `VITE_ANTHROPIC_API_KEY` 不一樣,這四個可以直接設成 Vercel 的環境變數,不用擔心洩漏風險。
6. **Authentication → Settings → Authorized domains**,把正式網域(例如 `class-schedule-scanner.vercel.app`)加進去——忘記這步,正式環境登入會出現 `auth/unauthorized-domain` 錯誤。
7. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 選同一個專案 → 憑證 → OAuth 2.0 用戶端 ID 裡的「Web client (auto created by Google Service)」→ 在「已授權的重新導向 URI」新增 `https://你的正式網域/__/auth/handler` 並儲存。
8. 把 `vercel.json` 裡 `rewrites` 的目的地改成你自己的 `https://<專案 ID>.firebaseapp.com/__/auth/:path*`。

第 7、8 步的原因:現在的瀏覽器(Chrome 115+、Firefox 109+、Safari 16.1+)會擋跨網域儲存,Firebase 預設放在 `<專案>.firebaseapp.com` 的登入輔助頁面因此傳不回登入結果,表現出來就是「選完 Google 帳號回到網站還是未登入」。解法是讓這些頁面從網站自己的網域提供:`vercel.json` 把 `/__/auth/*` 轉接到 Firebase,正式環境的 `authDomain` 則直接用網站自己的網域(見 `src/services/sync/firebaseConfig.ts`)。詳見 [Firebase 官方說明](https://firebase.google.com/docs/auth/web/redirect-best-practices)。本機開發伺服器沒有這層轉接,所以本機無法測試登入。

設定好之後,設定頁會多出「雲端同步」區塊,用 Google 帳號登入即可,登入一次會一直保持登入狀態。

## LINE 提醒設定(選用)

用 LINE 官方帳號把提醒傳到你的 LINE:每天早上一則今日課表,以及每堂課前的提醒。需要先完成上面的雲端同步(伺服器是讀雲端上的課表來發送的)。

**運作方式**:`api/line-notify.js` 是一支 Vercel 函式,每次被呼叫就檢查「現在有沒有該送的訊息」。Vercel 免費方案的排程一天只能跑一次(`vercel.json`,台灣時間早上 7 點多),所以另外用 GitHub Actions(`.github/workflows/line-notify.yml`)每 10 分鐘呼叫一次。GitHub 的排程在尖峰會延遲、偶爾會漏,所以課前提醒可能早到或晚到幾分鐘。

**費用**:LINE 官方帳號輕用量方案每月 200 則免費,每天摘要約 30 則,課前提醒每堂一則。

1. 到 [LINE Official Account Manager](https://manager.line.biz/) 建立一個官方帳號,在「設定 → Messaging API」啟用 Messaging API。
2. 到 [LINE Developers Console](https://developers.line.biz/console/) 打開對應的 channel:
   - **Messaging API** 分頁最下面,發行 **Channel access token (long-lived)**。
   - **Basic settings** 分頁最下面,複製 **Your user ID**(`U` 開頭)。
3. 用手機 LINE 掃 Messaging API 分頁上的 QR code,**把這個官方帳號加為好友**(沒加好友收不到訊息)。
4. Firebase 主控台 → 專案設定 → **服務帳戶** → 產生新的私密金鑰,會下載一個 JSON 檔。這個檔案等同整個資料庫的管理員權限,不要 commit、不要傳給別人。
5. 產生一組隨機字串當 `CRON_SECRET`(例如在終端機跑 `openssl rand -hex 32`)。
6. 在 Vercel 專案的 Environment Variables 新增下面五個,**類型都選 Secret**,而且**不能**加 `VITE_` 開頭(加了會被打包進公開的前端程式碼):

   | 名稱 | 值 |
   |---|---|
   | `CRON_SECRET` | 第 5 步的隨機字串 |
   | `LINE_CHANNEL_ACCESS_TOKEN` | 第 2 步的 token |
   | `LINE_USER_ID` | 第 2 步的 user ID |
   | `LINE_OWNER_EMAIL` | 你登入雲端同步用的 Google 帳號 |
   | `FIREBASE_SERVICE_ACCOUNT` | 第 4 步那個 JSON 檔的完整內容 |

   存好後 Redeploy 一次。
7. GitHub repo → Settings → Secrets and variables → Actions → New repository secret,新增 `CRON_SECRET`,值跟 Vercel 上的一樣。
8. 回到網站的設定頁 →「LINE 提醒」→ 按「發送測試訊息」,LINE 有收到就代表接好了,再勾選想要的提醒。

`LINE_OWNER_EMAIL` 的用途:網站是公開的,任何人都能用 Google 登入並有自己的雲端資料,伺服器只會讀這個帳號的課表、只會發給 `LINE_USER_ID`。

GitHub 會在 repo 連續 60 天沒有任何活動時自動停用排程,屆時到 repo 的 Actions 頁面重新啟用即可。

## 技術棧

React + Vite + TypeScript + Tailwind CSS,支援 PWA(可安裝到手機主畫面)。

## 架構

詳見 `src/schema/`(資料結構)與 `src/services/ai/`(AI 辨識呼叫,抽成可替換的 `ScheduleExtractor` 介面 —— 目前只有 Claude 的實作)。
