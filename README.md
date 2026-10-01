# pbon 派對售票系統

仿 [ibon 售票系統](https://ticket.ibon.com.tw/) 的假搶票網站：首頁有很多假活動，**只有派對主打場能真的買票**。

## 派對怎麼玩（推薦：自家 Wi‑Fi）

用你的電腦當主機，朋友連你家 Wi‑Fi，比手速搶票。

```bash
npm install
npm run party
```

終端機會印出區網網址，例如：

```text
http://192.168.x.x:3001
```

1. **電腦**用這個網址開啟（不要用別人手機開 `localhost`）
2. 主辦點「主辦」→ **接管首頁主打場**
3. 把頁面上的 **QR／連結** 傳給朋友
4. 大家逛假活動頁暖身，真正開賣只搶派對那場
5. 電腦別休眠、別關終端機

約 15 人同 Wi‑Fi 沒問題。

### Windows 查 IP（備用）

命令提示字元輸入 `ipconfig`，看「無線區域網路」的 IPv4。

### Mac 查 IP（備用）

終端機輸入 `ipconfig getifaddr en0`。

## 開發

```bash
npm run dev
```
