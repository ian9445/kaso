# 卡搜 KASO

卡搜是以安心可花、目標存錢與消費決策為核心的財務工具。主網站使用 Vanilla JavaScript ES Modules 與 Hash Router；管理後台和匿名流量統計由同一個 Site 的 Worker 與 D1 提供。

## 線上網址

- 主網站：https://card-scout-tw.cec13.chatgpt.site
- 管理後台：https://card-scout-tw.cec13.chatgpt.site/admin

## 本機開啟

ES Modules 必須透過 HTTP 伺服器載入。在專案根目錄執行：

```bash
npx serve .
```

再依終端機顯示的網址開啟網站。若電腦已安裝 Python 3，也可以使用：

```bash
python3 -m http.server 8080
```

並前往 `http://localhost:8080/#/home`。第一次使用時，網站會先引導到 `#/onboarding` 完成設定。

## 路由

| Hash 路由 | 頁面 |
| --- | --- |
| `#/onboarding` | 初次測驗與預算設定 |
| `#/home` | 首頁與預算總覽 |
| `#/search` | 商品比價 |
| `#/nearby` | 附近優惠 |
| `#/ledger` | 自動記帳 |
| `#/habits` | 消費習慣 |
| `#/overseas` | 海外刷卡試算 |

## 程式結構

- `index.html`：共用導覽列、`#app`、頁尾與模組入口。
- `assets/js/router.js`：Hash 路由、頁面生命週期與初次設定保護。
- `assets/js/routes.js`：路由、頁面及導覽列群組定義。
- `assets/js/pages/`：各功能頁的獨立模組。
- `assets/js/components/`：共用功能面板、登入、回饋與 AI 助手。
- `assets/js/services/`：預算計算與測驗判定。
- `assets/js/store.js`：共用狀態與瀏覽器儲存。
- `admin.html`：獨立管理後台。
- `worker/index.js`：匿名分析、回報與管理 API。
- `db/schema.ts`、`drizzle/`：D1 資料表與 migration。
- `scripts/`：正式環境建置與成品驗證。

首頁的「今日未用」會依安心可花、本月剩餘天數和今天的記帳金額即時計算。新增支出後回到首頁即可看到更新；若已超過日額，會顯示「今日超支」和實際超出金額。

「安心可花」以每月固定收入扣除固定支出與每月存款後的金額為基礎，再由目前餘額設定上限。首頁長條與百分比均由實際金額計算。

目標計畫族以明確的完成月份設定存款期限，設定頁會同步換算每日可安排金額；若低於 NT$1,000，會顯示延長完成月份的建議。

## 正式建置

```bash
npm run build
npm run validate
```

建置結果位於 `dist/`；請修改根目錄的原始檔，不要直接編輯 `dist/`。

## 附近店家定位

首頁「附近店家」連至 `#/nearby`。使用者按「使用目前位置」後才向瀏覽器請求一次定位；需要 HTTPS、瀏覽器位置權限及裝置定位服務。KASO 不將座標寫入 localStorage、Cookie、D1 或分析紀錄，離開頁面會取消查詢並忽略尚未完成的定位回呼。

店家來自 OpenStreetMap，由 `https://overpass.private.coffee/api/interpreter` 提供 Overpass 查詢。瀏覽器直接 POST 查詢，不需要 API key；位置會傳至該服務，取得位置後的嵌入地圖會將座標傳至 OpenStreetMap。清單包含餐飲、藥局與商店，以地圖上的店家座標計算直線距離，只保留 1,000 公尺內的結果並依距離排序。way/relation 使用資料的包圍盒中心，因此距離為估計值；Google Maps 連結可開啟步行導航。

資料可能缺少店名、地址、營業時間或未涵蓋全部店家。此功能不推算價格，也不宣稱所有店家符合預算或提供優惠。定位精度超過 1,000 公尺時請使用者重新定位；拒絕授權、定位逾時、查詢逾時、空結果及服務錯誤有不同提示。HTTP 429/406 遵守 Retry-After，至少等待 30 秒後才再送出查詢。

公開查詢服務的可用性、限流與 CORS 由服務端決定。若瀏覽器封鎖第三方請求，或服務暫時無法使用，頁面會保留錯誤提示與重試入口，不回退成示範店家。高流量部署前需依提供者最新政策評估服務容量。

相關資料：[Overpass 公開實例](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)、[HTTP/CORS](https://dev.overpass-api.de/command_line.html)、[OpenStreetMap 授權](https://www.openstreetmap.org/copyright)。

定位流程回歸檢查（已使用 Node.js 24 驗證）：

```bash
node --test scripts/check-nearby.mjs
```

這些檢查使用模擬位置與店家回應，涵蓋距離邊界、拒絕授權、逾時、取消、換頁、重試、限流與外部文字轉義，不會取得執行者的位置或呼叫外部查詢服務。
