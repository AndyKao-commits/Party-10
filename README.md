# pbon 售票系統

一打開就是仿 ibon 的售票站。後台可建立／編輯活動、假活動、假信用卡。

主打搶票場預設為 **YAWASABI「SUPER PLANET」in TAIPEI**。

## 你現在要做（Supabase）

在 SQL Editor **依序執行**（若尚未跑過）：
1. `supabase/schema.sql`
2. `supabase/schema-v2.sql`（假活動、假卡）
3. `supabase/schema-v3.sql`（活動海報欄位 + 寫入 YAWASABI 主打場）

Vercel 環境變數不用動；部署後重新 Deploy。

## 後台 `/admin`（手機友善）

密碼預設 `party2026`

分三頁：
1. **活動**：建立／編輯、總限量、海報上傳或貼網址、開賣時間、立刻開賣
2. **假活動**：改標題、文案、上傳／貼圖片（不會真的賣票）
3. **假信用卡**：一次產生多張（卡號／月年／四碼 CVV），分享給現場；結帳要輸入正確才過

## 訪客結帳

必須使用主辦發給的假卡資料刷卡（假的，不會真扣款）。
