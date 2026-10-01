# pbon 售票系統

一打開就是仿 ibon 的售票站首頁。訪客逛活動、搶票；你從後台登入建立活動並設定開賣時間。

## 訪客

開網站首頁 → 熱門活動／搜尋 → 點可購票活動 → 線上購票。

## 後台

網址：`/admin`  
預設密碼：`party2026`（可用環境變數 `VITE_ADMIN_PASSWORD` 改）

可建立活動、設定開賣時間、設為主打、立刻開賣。

## Vercel + Supabase

1. Supabase SQL Editor 執行 `supabase/schema.sql`
2. Vercel 環境變數：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`（建議自訂）
3. Deploy（Production 分支請用含最新程式的 `main`）

## 本機 Wi‑Fi

```bash
npm install
npm run party
```
