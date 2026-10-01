# pbon 派對售票系統

仿 [ibon 售票活動頁](https://ticket.ibon.com.tw/) 介面的**假搶票遊戲**，給小派對跟朋友一起玩。

一切都是假的：不會扣款、沒有真票、沒有法律效力。就是好玩。

## 怎麼玩

1. 主辦開啟房間（設定活動名、倒數秒數、限購張數、忙線機率）
2. 朋友用 6 碼房間碼加入
3. 一起盯著活動頁倒數 → 開賣後按「線上購票」
4. 流量控管 → 選票區 → 選張數 → 假付款 → 搶到顯示取票序號
5. 活動頁「搶票戰況」即時看誰搶到

## 開發

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- API / WS：http://localhost:3001

## 正式啟動（build 後）

```bash
npm run build
npm start
```

然後開 http://localhost:3001
