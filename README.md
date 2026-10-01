# pbon 派對售票系統

仿 [ibon 售票系統](https://ticket.ibon.com.tw/) 的假搶票網站：首頁有很多假活動，**只有派對主打場能真的買票**。

## 兩種玩法

### A. 自家 Wi‑Fi（不用帳號，推薦現場比手速）

```bash
npm install
npm run party
```

終端機會印 `http://192.168.x.x:3001` → 電腦開這個網址 → 主辦接管主打場 → 分享 QR。  
資料在記憶體，關程式就結束。

### B. Vercel + Supabase（有固定網址，不靠你家 Wi‑Fi）

1. **Supabase**（免費）
   - 開專案：https://supabase.com
   - SQL Editor 貼上並執行 `supabase/schema.sql`
   - Settings → API 複製 `Project URL`、`anon public` key

2. **本機先測**
   ```bash
   cp .env.example .env
   # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

3. **Vercel**（免費）
   - 匯入這個 GitHub repo
   - Environment Variables 加上同上兩個 `VITE_…`
   - Framework：Vite，Build `npm run build`，Output `dist`
   - 已附 `vercel.json`（SPA 路由）

有設 Supabase 環境變數時，網站會走雲端即時資料；沒設就走本機 Express。

## 怎麼玩

1. 大家開同一網址（區網或 Vercel）
2. 主辦 → 接管首頁主打場
3. 朋友點「PARTY HOUSE」購票；其他活動是假的會被擋
4. 「搶票戰況」即時看誰搶到（當下知道即可，不存檔也沒關係）
