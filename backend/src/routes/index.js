const express = require("express");
const router = express.Router();

const onboarding = require("../services/onboarding");
const budget = require("../services/budget");
const ledger = require("../services/ledger");
const price = require("../services/price");
const offers = require("../services/offers");
const assistant = require("../services/assistant");

function requireProfile(req, res, next) {
  if (!budget.getProfile()) {
    return res.status(409).json({ error: "no-profile", message: "尚未完成入口設定" });
  }
  next();
}

// ---- 入口 ----
router.get("/onboarding/quiz", (req, res) => res.json(onboarding.runQuiz()));
router.post("/onboarding/resolve", (req, res) => {
  const type = onboarding.resolveProfile(req.body.answers || {});
  res.json({ type });
});

// ---- 共用 / 個人檔案 ----
router.get("/profile", (req, res) => res.json(budget.getProfile()));
router.post("/profile", (req, res) => {
  try {
    res.json(onboarding.saveProfile(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/budget", requireProfile, (req, res) => res.json(budget.calcBudget()));
router.post("/budget/check", requireProfile, (req, res) => {
  const { amount, category } = req.body;
  res.json(budget.checkBudget(Number(amount), category || null));
});
router.post("/budget/settle", requireProfile, (req, res) => res.json(budget.dailySettle()));

// ---- 記帳 ----
router.get("/ledger", (req, res) => res.json(ledger.listEntries(req.query.month)));
router.post("/ledger", requireProfile, (req, res) => {
  try {
    res.status(201).json(ledger.addEntry(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete("/ledger/:id", (req, res) => {
  res.json({ removed: ledger.removeEntry(req.params.id) });
});

// ---- 比價 ----
// 篩選條件（都是選填，直接接在 query string）：
//   platform        平台代碼或名稱，例如 tw_mall_shopeemall 或「蝦皮商城」
//   min / max       價格區間
//   onlyAffordable  true = 只看安心可花以內的（這是我們的差異化）
//   cashback        true = 只看有回饋的平台
//   sort            price（預設，低到高）| price_desc | relevance
//   limit           回傳幾筆，預設 15
router.get("/products/search", async (req, res) => {
  const q = req.query.q || "";
  if (!q.trim()) {
    return res.json({
      items: [], matched: 0,
      facets: { platforms: [], priceRange: { min: 0, max: 0 }, affordableCount: 0, totalReturned: 0, cashbackCount: 0 },
      globalPlatforms: [], applied: {},
      lowPrice: 0, highPrice: 0, total: 0, safe: 0, source: "biggo",
    });
  }
  res.json(await price.search(q, req.query));
});
router.post("/products/evaluate", requireProfile, (req, res) => {
  res.json(price.evaluatePurchase(Number(req.body.price)));
});

// ---- 附近優惠 ----
router.post("/offers/nearby", requireProfile, async (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat/lng required" });
  }
  res.json(await offers.nearbyOffers(lat, lng));
});

// ---- KASO AI（Claude API） ----
router.post("/assistant/chat", async (req, res) => {
  const { message, history } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: "message required" });
  try {
    const reply = await assistant.chat(message, Array.isArray(history) ? history : []);
    res.json({ reply });
  } catch (err) {
    const status = err.code === "NO_API_KEY" ? 501 : 502;
    res.status(status).json({ error: err.code || "assistant-error", message: err.message });
  }
});

module.exports = router;
