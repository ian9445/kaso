// 比價層 — 對應「比價」表格。已決議：用總預算判定，不做 classifyItem()。
// 資料來源：真的打 BigGo 搜尋 API（見 providers/biggoProvider.js），不是假資料。
const biggoProvider = require("../providers/biggoProvider");
const { calcBudget, checkBudget, monthlySavingsTarget, fixedExpenseTotal } = require("./budget");
const { load } = require("../store");

// calcMonthsToAfford(): 月光族專用「出口」。shortfall ÷ 每月存款速度 = 幾個月後可入手。
function calcMonthsToAfford(shortfall, monthlySavingsRate) {
  if (shortfall <= 0) return 0;
  if (!monthlySavingsRate || monthlySavingsRate <= 0) return null; // 存款目標=0，算不出來
  return Math.ceil(shortfall / monthlySavingsRate);
}

// calcGoalDelay(): 目標計畫族。維持這次開支 → 目標延後幾個月。
function calcGoalDelay(over, monthlySavingsRate) {
  if (over <= 0) return 0;
  if (!monthlySavingsRate || monthlySavingsRate <= 0) return null;
  return Math.ceil(over / monthlySavingsRate);
}

// calcCutRatio(): 目標計畫族。想準時達成目標 → 六類各砍幾 %。
function calcCutRatio(over, totalExpenses) {
  if (over <= 0) return 0;
  if (!totalExpenses || totalExpenses <= 0) return null;
  return Math.min(1, over / totalExpenses);
}

// searchProduct() + fetchPrices() + getLowestPrice()：BigGo 一次查詢就回一份跨平台候選清單，
// 每一筆已經是「某平台的一個刊登」，所以不用像假資料時代那樣另外組 platform×price 矩陣。
async function search(keyword) {
  const { items, lowPrice, highPrice, total, error } = await biggoProvider.searchProducts(keyword);
  const state = load();
  const budget = calcBudget(state);
  const safe = budget ? budget.safe : 0;
  return {
    items: items.map((item) => ({ ...item, withinBudget: item.price <= safe })),
    lowPrice, highPrice, total, safe, source: "biggo", error: error || null,
  };
}

// 針對使用者選定的一筆刊登價格跑一次完整判定，回傳兩種身分各自需要的呈現資料。
// listAffordable()（月光族的「列出買得起的」）交給前端：前端已經有整批 BigGo 搜尋結果，
// 直接從同一批結果裡挑「價格 <= 安心可花」的其他刊登即可，不需要另外的商品目錄。
function evaluatePurchase(price) {
  const state = load();
  const profile = state.profile;
  if (!profile) return { ok: false, reason: "no-profile" };

  const budget = calcBudget(state);
  const decision = checkBudget(price, null, state); // 已決議：比價用總預算，不帶 category

  if (decision.withinBudget) {
    return { withinBudget: true, safe: budget.safe, remainingAfterPurchase: budget.safe - price };
  }

  const over = price - budget.safe;
  const savingsRate = monthlySavingsTarget(profile);

  if (profile.type === "moonlight") {
    return {
      withinBudget: false,
      profileType: "moonlight",
      safe: budget.safe,
      overAmount: over, // showOverAmount()
      monthsToAfford: calcMonthsToAfford(over, savingsRate), // calcMonthsToAfford()
    };
  }

  // goal 身分：不擋，只換算代價，兩個選項都給
  const totalExpenses = fixedExpenseTotal(profile);
  return {
    withinBudget: false,
    profileType: "goal",
    safe: budget.safe,
    overAmount: over,
    options: {
      keepSpending: { goalDelayMonths: calcGoalDelay(over, savingsRate) }, // calcGoalDelay()
      stayOnSchedule: { cutRatio: calcCutRatio(over, totalExpenses) }, // calcCutRatio()
    },
  };
}

module.exports = { search, evaluatePurchase, calcMonthsToAfford, calcGoalDelay, calcCutRatio };
