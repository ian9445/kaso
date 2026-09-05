# KASO 卡搜

KASO 是以可花餘額、目標存錢與消費決策為核心的財務工具。

## 線上版本

- 主網站：https://card-scout-tw.cec13.chatgpt.site
- 管理後台：https://card-scout-tw.cec13.chatgpt.site/admin

## 程式結構

- `index.html`：KASO 使用者主網站
- `admin.html`：獨立管理後台
- `worker/index.js`：分析、回報與管理 API
- `db/schema.ts`：資料表結構
- `drizzle/`：正式環境資料庫 migration
- `scripts/`：建置與成品檢查

主網站與管理後台位於同一個 GitHub 分支，但維持不同 HTML 檔案。主網站會匿名回報在線狀態與瀏覽事件，不儲存 IP 或建立裝置指紋；管理後台登入資料由正式環境安全設定，不寫入 GitHub。

## 本機開啟

直接開啟 `index.html` 可查看主介面。分析、共用回報與管理後台需要 Worker 與 D1 資料庫環境才會運作。

> 後續介面調整仍先修改 HTML，再同步至正式網站。
