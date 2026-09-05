// 比價的篩選與分類層。
//
// 為什麼放在我們這邊做：BigGo 的搜尋 API 不吃任何篩選參數（實測 nindex / price_min /
// price_max / sort / page / size 全部被忽略），一次固定回 30 筆。所以篩選只能對這 30 筆做。
//
// facet（可選的篩選條件與各自筆數）也一律從「這次實際拿到的結果」算，
// 不用 BigGo 回的全站 count——不然畫面會出現「蝦皮 3,028 筆」但按下去只剩 2 筆的落差。

const SORTS = {
  price: (a, b) => a.price - b.price, // 低到高（預設）
  price_desc: (a, b) => b.price - a.price,
  relevance: () => 0, // 維持 BigGo 原始順序
};

function toNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v) {
  return v === true || v === "true" || v === "1" || v === 1;
}

/**
 * 從一批商品算出可用的篩選條件與各自筆數。
 * @param {Array} items 未篩選的商品清單
 * @param {number} safe 安心可花（用來算「預算內有幾筆」）
 */
function buildFacets(items, safe) {
  const byPlatform = new Map();
  for (const item of items) {
    const code = item.platformCode || item.platform || "unknown";
    if (!byPlatform.has(code)) {
      byPlatform.set(code, {
        code,
        name: item.platform || code,
        logo: item.platformLogo || null,
        cashback: !!item.cashback,
        count: 0,
        minPrice: Infinity,
      });
    }
    const row = byPlatform.get(code);
    row.count += 1;
    if (item.price < row.minPrice) row.minPrice = item.price;
  }

  const platforms = [...byPlatform.values()]
    .map((p) => ({ ...p, minPrice: p.minPrice === Infinity ? null : p.minPrice }))
    .sort((a, b) => b.count - a.count || a.minPrice - b.minPrice);

  const prices = items.map((i) => i.price).filter((n) => Number.isFinite(n));
  const affordableCount =
    Number.isFinite(safe) && safe > 0 ? items.filter((i) => i.price <= safe).length : 0;

  return {
    platforms,
    priceRange: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : { min: 0, max: 0 },
    affordableCount,
    totalReturned: items.length,
    cashbackCount: items.filter((i) => i.cashback).length,
  };
}

/**
 * 套用篩選條件。
 * @param {Array} items 未篩選的商品清單
 * @param {object} query 篩選條件（通常來自 req.query）
 * @param {number} safe 安心可花
 */
function applyFilters(items, query = {}, safe = 0) {
  const platform = query.platform ? String(query.platform).trim() : null;
  const min = toNumber(query.min ?? query.minPrice);
  const max = toNumber(query.max ?? query.maxPrice);
  const onlyAffordable = toBool(query.onlyAffordable ?? query.affordable);
  const cashbackOnly = toBool(query.cashback);
  const sortKey = SORTS[query.sort] ? query.sort : "price";
  const limit = toNumber(query.limit) || 15;

  let out = items.slice();

  if (platform) {
    // 允許用代碼或顯示名稱來篩，前端兩種都好接
    out = out.filter(
      (i) => i.platformCode === platform || (i.platform && i.platform === platform)
    );
  }
  if (min !== null) out = out.filter((i) => i.price >= min);
  if (max !== null) out = out.filter((i) => i.price <= max);
  if (cashbackOnly) out = out.filter((i) => i.cashback);
  // 「只看預算內」是我們的差異化，放在最後一道
  if (onlyAffordable && safe > 0) out = out.filter((i) => i.price <= safe);

  out.sort(SORTS[sortKey]);

  return {
    items: out.slice(0, limit),
    matched: out.length,
    applied: {
      platform: platform || null,
      min,
      max,
      onlyAffordable,
      cashbackOnly,
      sort: sortKey,
      limit,
    },
  };
}

module.exports = { applyFilters, buildFacets, SORTS };
