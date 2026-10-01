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

設定好之後,設定頁會多出「雲端同步」區塊,用 Google 帳號登入即可,登入一次會一直保持登入狀態。

## 技術棧

React + Vite + TypeScript + Tailwind CSS,支援 PWA(可安裝到手機主畫面)。

## 架構

詳見 `src/schema/`(資料結構)與 `src/services/ai/`(AI 辨識呼叫,抽成可替換的 `ScheduleExtractor` 介面 —— 目前只有 Claude 的實作)。
