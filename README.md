# 課表掃描與上課提醒

上傳課表截圖或 PDF,用 Claude Vision API 辨識成結構化課表,並提供上課提醒(瀏覽器通知 + .ics 行事曆匯出)。純前端 SPA,無後端伺服器。

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

## 技術棧

React + Vite + TypeScript + Tailwind CSS,支援 PWA(可安裝到手機主畫面)。

## 架構

詳見 `src/schema/`(資料結構)與 `src/services/ai/`(AI 辨識呼叫,抽成可替換的 `ScheduleExtractor` 介面 —— 目前只有 Claude 的實作)。
