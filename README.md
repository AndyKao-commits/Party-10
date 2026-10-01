# pbon 派對售票系統

仿 [ibon 售票系統](https://ticket.ibon.com.tw/) 的**假搶票網站**：首頁有一堆假活動，**只有派對主打場能真的買票**。

## 推薦免費上架：Render

1. 把程式推到 GitHub
2. 到 [Render](https://render.com) 用 GitHub 登入
3. **New → Web Service**，選這個 repo
4. 會讀 `render.yaml`（或手動填）：
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Plan: **Free**
5. 部署完會得到網址，例如 `https://pbon-party-ticket.onrender.com`
6. 手機打開該網址就能玩

注意：Render 免費版閒置會休眠，第一次開啟可能要等 30～60 秒。派對開始前先讓主辦打開網站「叫醒」它。

## 怎麼玩（15 人 OK）

1. 大家打開同一個網站首頁（看起來很像售票站）
2. 主辦進「主辦」→ **接管首頁主打場**
3. 朋友點首頁「PARTY HOUSE…／查看活動／購票」
4. 其他活動點進去也能看，但會被擋（流量控管／已結束）
5. 開賣後一起搶

## 本機／筆電開

```bash
npm install
npm run party
```

開 `http://筆電區網IP:3001`，再分享給同 Wi‑Fi 朋友。

## 開發

```bash
npm run dev
```
