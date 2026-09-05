// 真的打 BigGo 的搜尋 API（沒有公開文件，但 BigGo 官方的 MCP Server 就是打這支，不需要 API key）：
// https://github.com/Funmula-Corp/BigGo-MCP-Server/blob/master/src/biggo_mcp_server/services/product_search.py
//
// 這支 API 回來的每一筆是「某平台上的一個商品刊登」，不是「同一款商品在五個平台的價格」，
// 所以一次查詢就是一份跨平台的候選清單，直接依價格排序即可，不需要另外做同品項比對。
const BASE_URL = "https://api.biggo.com/api/v1/spa/search";
const SITE = "biggo.com.tw";
const REGION = "tw";

async function searchProducts(keyword, limit = 15) {
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
        platform: item.store?.name || item.nindex,
        image: item.image,
        url: item.affurl ? `https://${SITE}${item.affurl}` : item.purl,
        isAd: !!item.is_ad,
      }))
      .sort((a, b) => a.price - b.price)
      .slice(0, limit);
    return { items, lowPrice: json.low_price, highPrice: json.high_price, total: json.total, source: "biggo" };
  } catch (err) {
    clearTimeout(timeout);
    return { items: [], lowPrice: 0, highPrice: 0, total: 0, source: "biggo", error: err.message };
  }
}

module.exports = { searchProducts };
