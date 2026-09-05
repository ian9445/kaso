// 篩選層的自我檢查。不用測試框架，node test/priceFilters.test.js 直接跑。
// 前半段用固定假資料驗邏輯（不連網、可重複）；後半段真的打一次 BigGo 確認端點還活著。
const assert = require("node:assert");
const { applyFilters, buildFacets } = require("../src/services/priceFilters");

const SAFE = 5000;
const SAMPLE = [
  { id: 1, title: "A", price: 1200, platformCode: "tw_pec_momoshop", platform: "momo購物網", cashback: false },
  { id: 2, title: "B", price: 3200, platformCode: "tw_mall_shopeemall", platform: "蝦皮商城", cashback: true },
  { id: 3, title: "C", price: 4800, platformCode: "tw_mall_shopeemall", platform: "蝦皮商城", cashback: true },
  { id: 4, title: "D", price: 6500, platformCode: "tw_pec_momoshop", platform: "momo購物網", cashback: false },
  { id: 5, title: "E", price: 9900, platformCode: "tw_pmall_rakuten", platform: "樂天市場", cashback: false },
];

let pass = 0;
const ok = (name, fn) => {
  try { fn(); console.log("  PASS  " + name); pass++; }
  catch (e) { console.log("  FAIL  " + name + "\n        " + e.message); process.exitCode = 1; }
};

console.log("=== facet 計算 ===");
const f = buildFacets(SAMPLE, SAFE);
ok("平台數 = 3", () => assert.equal(f.platforms.length, 3));
ok("排序：先看筆數，同票時最低價便宜的排前面", () => {
  // momo 與蝦皮都是 2 筆，momo 最低 1200 < 蝦皮 3200，所以 momo 在前
  assert.deepEqual(f.platforms.map((p) => p.name), ["momo購物網", "蝦皮商城", "樂天市場"]);
  assert.deepEqual(f.platforms.map((p) => p.count), [2, 2, 1]);
});
ok("各平台最低價正確", () => {
  assert.deepEqual(f.platforms.map((p) => p.minPrice), [1200, 3200, 9900]);
});
ok("價格區間 1200~9900", () => assert.deepEqual(f.priceRange, { min: 1200, max: 9900 }));
ok("預算內 3 筆（<=5000）", () => assert.equal(f.affordableCount, 3));
ok("有回饋 2 筆", () => assert.equal(f.cashbackCount, 2));

console.log("\n=== 篩選 ===");
ok("不帶條件 → 全部 5 筆、依價格由低到高", () => {
  const r = applyFilters(SAMPLE, {}, SAFE);
  assert.equal(r.matched, 5);
  assert.deepEqual(r.items.map((i) => i.price), [1200, 3200, 4800, 6500, 9900]);
});
ok("用平台代碼篩 → 蝦皮 2 筆", () => {
  const r = applyFilters(SAMPLE, { platform: "tw_mall_shopeemall" }, SAFE);
  assert.equal(r.matched, 2);
});
ok("用平台中文名篩 → 一樣 2 筆", () => {
  const r = applyFilters(SAMPLE, { platform: "蝦皮商城" }, SAFE);
  assert.equal(r.matched, 2);
});
ok("價格區間 3000~7000 → 3 筆", () => {
  const r = applyFilters(SAMPLE, { min: 3000, max: 7000 }, SAFE);
  assert.deepEqual(r.items.map((i) => i.price), [3200, 4800, 6500]);
});
ok("只看預算內 → 3 筆，最高不超過 5000", () => {
  const r = applyFilters(SAMPLE, { onlyAffordable: "true" }, SAFE);
  assert.equal(r.matched, 3);
  assert.ok(r.items.every((i) => i.price <= SAFE));
});
ok("只看有回饋 → 2 筆", () => {
  const r = applyFilters(SAMPLE, { cashback: "1" }, SAFE);
  assert.equal(r.matched, 2);
});
ok("由高到低排序", () => {
  const r = applyFilters(SAMPLE, { sort: "price_desc" }, SAFE);
  assert.equal(r.items[0].price, 9900);
});
ok("limit 生效但 matched 保留真實筆數", () => {
  const r = applyFilters(SAMPLE, { limit: 2 }, SAFE);
  assert.equal(r.items.length, 2);
  assert.equal(r.matched, 5);
});
ok("條件疊加：蝦皮 + 只看預算內 → 2 筆", () => {
  const r = applyFilters(SAMPLE, { platform: "蝦皮商城", onlyAffordable: "true" }, SAFE);
  assert.equal(r.matched, 2);
});
ok("safe=0 時「只看預算內」不會把結果清空", () => {
  const r = applyFilters(SAMPLE, { onlyAffordable: "true" }, 0);
  assert.equal(r.matched, 5);
});
ok("亂填的排序值會退回預設", () => {
  const r = applyFilters(SAMPLE, { sort: "隨便" }, SAFE);
  assert.equal(r.applied.sort, "price");
});

// ---- 真的連 BigGo 一次，確認端點沒死 ----
(async () => {
  console.log("\n=== 實際打 BigGo API ===");
  try {
    const { searchProducts } = require("../src/providers/biggoProvider");
    const r = await searchProducts("airpods");
    if (r.error) {
      console.log("  SKIP  連線失敗（可能沒網路）：" + r.error);
    } else {
      ok("有拿到商品", () => assert.ok(r.items.length > 0));
      ok("每筆都有 platformCode", () => assert.ok(r.items.every((i) => i.platformCode)));
      ok("每筆都有連結", () => assert.ok(r.items.every((i) => i.url)));
      ok("globalPlatforms 有資料", () => assert.ok(r.globalPlatforms.length > 0));
      const facets = buildFacets(r.items, 5000);
      console.log("  → 實際結果：" + r.items.length + " 筆，" + facets.platforms.length + " 個平台，價格 " +
        facets.priceRange.min + "~" + facets.priceRange.max);
      console.log("  → 平台分佈：" + facets.platforms.slice(0, 5).map((p) => p.name + "(" + p.count + ")").join("、"));
    }
  } catch (e) {
    console.log("  SKIP  " + e.message);
  }
  console.log("\n通過 " + pass + " 項");
})();
