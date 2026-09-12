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

首頁「附近店家」連至 `#/nearby`。頁面不會在進入時自動要求精準定位，使用者可以選擇「使用精準目前位置」，或完全不開位置權限，直接點地圖、拖曳後搜尋地圖中央。瀏覽器仍會在使用精準定位時顯示必要的同意提示；拒絕後不會卡住，會引導改用地圖選點。

正式模式使用 Google Maps JavaScript API 與 Places API (New)。地圖標點、下方清單與可複選分類同步；預設勾選常用的「餐廳／小吃」及「咖啡／飲料／甜點」，也可選擇日常採買、購物及生活服務，或一次勾選多類。Google Nearby Search 每次最多回傳 20 間，預設依熱門程度排序，也可改依距離、店名或類型排列。

店家卡片會使用 Places 回傳的第一張公開照片，內容可能是店面、餐點、商品或使用者上傳的其他店家照片，取決於 Google 現有資料，不能保證每間都有。畫面會顯示照片作者標示；照片網址不寫入 localStorage、Cookie 或 D1，也不快取。沒有照片時明確顯示分類圖示與「尚無公開照片」，不使用可能不相關的示意圖冒充店家照片。

Google Maps 未設定、腳本載入失敗或 Places 搜尋暫時不可用時，網站會保留原本的 Leaflet、OpenStreetMap 與 Overpass 查詢作為備援，不會讓附近店家頁整頁失效。備援模式不會有 Google 店家照片。瀏覽器以同源 `POST /api/nearby` 呼叫後端，再由後端查詢公開 Overpass 節點；目前優先使用 VK Maps 節點，Private.coffee 為第二節點。

### Google Maps 設定

1. 在有啟用帳單的 Google Cloud 專案啟用 **Maps JavaScript API** 與 **Places API (New)**。
2. 建立「網站」用 API key，網站限制加入 `https://card-scout-tw.cec13.chatgpt.site/*`，API 限制只允許上述兩個 API。不要使用未限制的 key。
3. 在 Site 的環境變數新增 `GOOGLE_MAPS_BROWSER_KEY`。這是瀏覽器用 key，執行時本來就會傳到使用者瀏覽器，因此安全邊界是 Google Cloud 的網站與 API 限制。
4. 可選：在 Google Cloud 建立 Map ID，並於 Site 新增 `GOOGLE_MAPS_MAP_ID`；未設定時使用 Google 的示範 Map ID 顯示進階標點。

同源 `GET /api/maps-config` 只在執行時回傳瀏覽器地圖設定並使用 `no-store`，原始碼不含 key。部署前應在 Google Cloud 設定配額與預算警示。設定文件：[Google Maps Platform 開始使用](https://developers.google.com/maps/get-started)、[API key 安全最佳實務](https://developers.google.com/maps/api-security-best-practices)、[Nearby Search](https://developers.google.com/maps/documentation/javascript/nearby-search)、[Place Photos](https://developers.google.com/maps/documentation/javascript/place-photos)。

後端的 `GET /api/location-hint` 只把 Cloudflare 提供的位置四捨五入到小數點後兩位，用來把未定位的地圖粗略移到城市附近；若沒有資料則顯示台灣全圖。KASO 不將精準座標或粗略提示寫入 localStorage、Cookie、D1 或分析紀錄，離開頁面會取消查詢並忽略尚未完成的定位回呼。

資料可能缺少店名、地址、照片或未涵蓋全部店家。此功能不推算價格，也不宣稱所有店家符合預算或提供優惠。定位精度超過 1,000 公尺時會建議改用地圖選點；拒絕授權、定位逾時、查詢逾時、空結果及服務錯誤有不同提示。Overpass 的 HTTP 429 會遵守 Retry-After，至少等待 30 秒後才再送出查詢。

公開查詢服務的可用性與限流由服務端決定。若兩個查詢節點都暫時無法使用，頁面會保留錯誤提示與重試入口，不回退成示範店家。高流量部署前需依提供者最新政策評估服務容量。


備援資料：[Overpass 公開實例](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)、[HTTP/CORS](https://dev.overpass-api.de/command_line.html)、[OpenStreetMap 授權](https://www.openstreetmap.org/copyright)。

定位流程回歸檢查（已使用 Node.js 24 驗證）：

```bash
node --test scripts/check-nearby.mjs
```

這些檢查使用模擬位置與店家回應，涵蓋 Google 類別與照片欄位、照片作者標示、距離邊界、複選分類、拒絕授權、逾時、取消、換頁、重試、限流與外部文字轉義，不會取得執行者的位置或呼叫外部查詢服務。
