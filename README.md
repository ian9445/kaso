# KASO 卡搜

KASO 是以月光族／目標存錢、可花餘額與消費決策為核心的財務工具。這個 repo 同時包含前端（`index.html`）與後端（`backend/`），依 `KASO_架構定案.html` 的 function 清單實作。

## 線上版本（原始 HTML 互動稿，純前端展示）

https://card-scout-tw.cec13.chatgpt.site

## 結構

```
index.html   前端，單頁互動稿，已接上 backend 的 API
backend/     Node.js + Express 後端，實作架構定案的 function 清單
```

## 執行方式

```bash
cd backend
npm install
npm start
```

打開 http://localhost:3000 — 同一個 Express server 同時提供 API（`/api/*`）與前端靜態頁面（`index.html`），不需要另外啟動前端。

資料存在 `backend/data/store.json`（單一使用者、單機檔案儲存，刪掉這個檔案就等於重設所有資料）。

## 需要的 API key

### Claude API（KASO AI 助手）

1. 複製 `backend/.env.example` 為 `backend/.env`
2. 到 https://console.anthropic.com/settings/keys 拿一組 key，貼到 `.env` 的 `ANTHROPIC_API_KEY=`
3. 重啟後端（`npm start`）

`.env` 已經加進 `.gitignore`，key 只會在後端讀取（`backend/src/services/assistant.js`），前端完全拿不到、也不會經過前端的網路請求。沒設定 key 的話，KASO AI 面板會回覆「暫時連不上」，其他功能不受影響。

### BigGo（商品比價）

不需要 key。`backend/src/providers/biggoProvider.js` 直接打 BigGo 公開的搜尋 API（沒有官方文件，是從 BigGo 官方的 [BigGo-MCP-Server](https://github.com/Funmula-Corp/BigGo-MCP-Server) 原始碼裡找到的端點），基本商品搜尋不需要註冊或憑證。

## 架構定案 → 程式碼對應

| 架構定案分區 | 檔案 |
|---|---|
| 共用（getProfile/calcBudget/checkBudget/getSpentThisMonth/dailySettle） | `backend/src/services/budget.js` |
| 入口（runQuiz/resolveProfile/saveProfile） | `backend/src/services/onboarding.js` |
| 比價（searchProduct/fetchPrices/getLowestPrice/calcMonthsToAfford/calcGoalDelay/calcCutRatio） | `backend/src/services/price.js` + `backend/src/providers/biggoProvider.js` |
| 優惠（fetchNearbyStores/fetchOffers/classifyOffer/sortByDistance） | `backend/src/services/offers.js` + `backend/src/providers/offerProvider.js` |
| 記帳（本月已花的資料來源） | `backend/src/services/ledger.js` |
| KASO AI（架構定案沒有寫，這次額外加的） | `backend/src/services/assistant.js` |
| HTTP 路由 | `backend/src/routes/index.js` |
| 前端串接 | `index.html`（`<script>` 內的 `api()` 呼叫 `/api/*`） |

## 已決議的兩件事（已套用到程式碼）

1. **商品比價用「總預算」判定** — 沒有做 `classifyItem()`。`checkBudget()` 不帶 category 時直接跟「安心可花」比。
2. **附近優惠先不接信用卡官網** — 只做政府活動 + 文化幣兩個來源（`offerProvider.js` 的 `OFFER_POOL`），介面已預留：之後要加信用卡官網，只要在 `fetchOffers()` 多合併一個來源即可，不用動其他程式碼。

## 資料來源現況

- **比價資料**：真的打 BigGo 搜尋 API（`biggoProvider.js`）。回來的是「跨平台候選刊登」清單（例如同一個關鍵字會混到 momo、酷澎、樂天等平台的商品），不是「同一款商品在五個平台各自的價格」，所以沒有另外做同品項比對，直接依價格排序呈現，符合架構定案「不自己做同品項比對」的精神。
- **附近優惠**：`offers.js` 的 `fetchNearbyStores()` 是打真的 Overpass（OpenStreetMap）API 抓 1,000 公尺內店家；離線或 API 擋掉時才會退回假資料，並在回傳的店家上標記 `mocked: true`。政府活動／文化幣優惠（`offerProvider.js`）目前是假資料，之後要接真實來源時只要換 `fetchOffers()`。
- **KASO AI**：真的打 Claude API，會把使用者當下的身分／預算／各分類花費即時餵給 Claude 當 system prompt，回答會反映真實數字。回覆支援簡單 markdown（`**粗體**`、`` `code` ``），前端會轉成真的粗體/等寬字，不會顯示成字面上的星號。

## 沒有規則可循、屬於本次實作假設的部分

架構定案沒有給出精確公式的幾個地方，這次用了合理但屬於假設的算法（如果之後有更明確的規則，改 `backend/src/services/price.js` 即可）：

- `calcMonthsToAfford` / `calcGoalDelay`：超出金額 ÷ 每月存款速度，無條件進位。
- `calcCutRatio`：超出金額 ÷ 六大分類總支出，上限 100%。
- 優惠分類對應：店家的 OpenStreetMap 分類（餐廳、超市、書店…）對應到食衣住行育樂六類的表格在 `offerProvider.js` 的 `OSM_TAG_TO_CATEGORY`。

## 已刪除 / 未實作（依架構定案或優先順序）

- **辦卡推薦**：架構定案已決議不做，前端的入口與頁面已整個移除。
- **旅遊規劃 / 保險保障 / 訂閱比較 / 海外刷卡試算 / 使用說明 FAQ**：架構定案標示 P3，維持原本前端的靜態展示，沒有接後端。

## 前端主要改動（相對於原本 GitHub 版本）

- 第一步從「三選一直接點選」改成「二選一問答」（`runQuiz()`），並移除已刪除的「回饋模式」。
- 收支輸入從單一「每月固定支出」改成食衣住行育樂六欄，跟後端的 `expenses` 結構一致。
- 首頁的預算圓餅圖、每日結算、記帳、商品比價、附近優惠都改成呼叫後端 API，不再是寫死的假資料。
