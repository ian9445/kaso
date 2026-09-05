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
router.get("/products/search", async (req, res) => {
  const q = req.query.q || "";
  if (!q.trim()) return res.json({ items: [], lowPrice: 0, highPrice: 0, total: 0, safe: 0, source: "biggo" });
  res.json(await price.search(q));
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

// ---- 前端設定 ----
// Google Maps JavaScript API 的 key 設計上就是給瀏覽器用的（用 HTTP referrer 限制，不是靠保密），
// 跟 Claude/BigGo 那種必須留在後端的 key 不一樣，所以這裡直接回傳給前端沒問題。
router.get("/config", (req, res) => {
  res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null });
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
