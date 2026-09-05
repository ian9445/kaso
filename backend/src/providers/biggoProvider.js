// 真的打 BigGo 的搜尋 API（沒有公開文件，但 BigGo 官方的 MCP Server 就是打這支，不需要 API key）：
// https://github.com/Funmula-Corp/BigGo-MCP-Server/blob/master/src/biggo_mcp_server/services/product_search.py
//
// 這支 API 回來的每一筆是「某平台上的一個商品刊登」，不是「同一款商品在五個平台的價格」，
// 所以一次查詢就是一份跨平台的候選清單，直接依價格排序即可，不需要另外做同品項比對。
//
// ⚠️ 實測（2026-09-05）：這支 API **不支援伺服器端篩選**。
//    試過 nindex / price_min / price_max / sort / page / size，全部被忽略，
//    回傳的 total、list 筆數、價格區間完全一樣。
//    → 篩選一律在我們自己這一層對回傳的清單做。
const BASE_URL = "https://api.biggo.com/api/v1/spa/search";
const SITE = "biggo.com.tw";
const REGION = "tw";

// BigGo 一次固定回 30 筆。先全部拿回來，篩選交給上層，不在這裡切。
const RAW_LIMIT = 30;

async function searchProducts(keyword, limit = RAW_LIMIT) {
  const url = `${BASE_URL}/${encodeURIComponent(keyword)}/product`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", site: SITE, region: REGION },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`biggo api ${res.status}`);
    const json = await res.json();

    const items = (json.list || [])
      .filter((item) => item.price > 0)
      .map((item) => ({
        id: item.item_id,
        title: item.title,
        price: item.price,
        currency: item.currency || "TWD",
        // platformCode 是 BigGo 的平台代碼（tw_mall_shopeemall…），用來做穩定的篩選比對；
        // platform 是給人看的名字，可能有空白或重複。
        platformCode: item.nindex || null,
        platform: item.store?.name || item.nindex,
        platformLogo: item.store?.image || null,
        cashback: !!item.store?.is_cashback,
        image: item.image,
        url: item.affurl ? `https://${SITE}${item.affurl}` : item.purl,
        // 之後要接價格歷史用得到：extension.biggo.com/api/product_price_history.php
        historyId: item.history_id || null,
        oid: item.oid || null,
        isAd: !!item.is_ad,
      }))
      .sort((a, b) => a.price - b.price)
      .slice(0, limit);

    return {
      items,
      lowPrice: json.low_price,
      highPrice: json.high_price,
      total: json.total,
      // BigGo 自己回的平台清單。注意 count 是「全站 15 萬筆」裡的數量，
      // 不是我們這 30 筆裡的數量，所以只當參考；實際 facet 由 price.js 從結果重算。
      globalPlatforms: normalizePlatforms(json.filter),
      source: "biggo",
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      items: [],
      lowPrice: 0,
      highPrice: 0,
      total: 0,
      globalPlatforms: [],
      source: "biggo",
      error: err.message,
    };
  }
}

// json.filter 是以 nindex 為 key 的物件，攤平成陣列比較好用。
function normalizePlatforms(filter) {
  if (!filter || typeof filter !== "object") return [];
  return Object.entries(filter)
    .filter(([, v]) => v && typeof v === "object" && v.name)
    .map(([code, v]) => ({
      code,
      name: String(v.name).trim(),
      globalCount: v.count || 0,
      logo: v.image || null,
      cashback: !!v.cashback,
    }))
    .sort((a, b) => b.globalCount - a.globalCount);
}

module.exports = { searchProducts, RAW_LIMIT };
