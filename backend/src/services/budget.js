// 共用層 — 三個區塊都會呼叫。對應 KASO_架構定案.html 的「共用」表格。
const { load, save, CATEGORIES } = require("../store");

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function getProfile() {
  return load().profile;
}

// 存款目標：月光族 = 使用者自己設；目標計畫族 = 目標金額 ÷ 期望月數
function monthlySavingsTarget(profile) {
  if (!profile) return 0;
  if (profile.type === "moonlight") return profile.monthlySave || 0;
  if (profile.type === "goal" && profile.goal?.months > 0) {
    return profile.goal.amount / profile.goal.months;
  }
  return 0;
}

function fixedExpenseTotal(profile) {
  if (!profile) return 0;
  return CATEGORIES.reduce((sum, c) => sum + (profile.expenses?.[c] || 0), 0);
}

// 本月已花 ← 來自記帳。沒有記帳，這格永遠是 0。
function getSpentThisMonth(state = load(), month = todayStr().slice(0, 7)) {
  return state.ledger
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + e.amount, 0);
}

function getSpentThisMonthByCategory(category, state = load(), month = todayStr().slice(0, 7)) {
  return state.ledger
    .filter((e) => e.date.startsWith(month) && e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

// 目前餘額 − 固定支出 − 存款目標 − 本月已花 = 安心可花
function calcBudget(state = load()) {
  const { profile } = state;
  if (!profile) return null;
  const fixedExpense = fixedExpenseTotal(profile);
  const savingsGoal = monthlySavingsTarget(profile);
  const spentThisMonth = getSpentThisMonth(state);
  const safe = profile.currentBalance - fixedExpense - savingsGoal - spentThisMonth;
  return {
    currentBalance: profile.currentBalance,
    fixedExpense,
    savingsGoal,
    spentThisMonth,
    safe,
  };
}

// 全系統唯一判定。金額必比對象：
//   - 不帶 category（比價，依已定案：用總預算） → 跟「安心可花」比
//   - 帶 category（附近優惠，依已定案：用分類）  → 跟「該分類剩餘預算」比
// 分類剩餘預算 = 該分類的月支出額度（inputExpense 填的數字）− 該分類本月已花
function checkBudget(amount, category = null, state = load()) {
  const budget = calcBudget(state);
  if (!budget) return { ok: false, reason: "no-profile" };

  if (category) {
    const categoryBudget = state.profile.expenses?.[category] || 0;
    const categorySpent = getSpentThisMonthByCategory(category, state);
    const remaining = categoryBudget - categorySpent;
    return { withinBudget: amount <= remaining, remaining, basis: "category", category };
  }

  return { withinBudget: amount <= budget.safe, remaining: budget.safe, basis: "total" };
}

// 每日結算：今天沒用完的移回餘額。
// dailyQuota = 安心可花 ÷ 本月剩餘天數；今天已花（記帳中 date=今天 的加總）；未用完的部分視同「還在餘額裡」，
// 這裡以寫入 settle.log 的方式呈現「今天結算過了」，不重複扣，並回傳未用完金額給前端顯示動畫用。
function dailySettle(state = load()) {
  const budget = calcBudget(state);
  if (!budget) return { ok: false, reason: "no-profile" };

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
  const dailyQuota = budget.safe / daysRemaining;
  const spentToday = state.ledger.filter((e) => e.date === todayStr()).reduce((s, e) => s + e.amount, 0);
  const unused = Math.max(0, dailyQuota - spentToday);

  const today = todayStr();
  if (state.settle.lastSettleDate !== today) {
    state.settle.lastSettleDate = today;
    state.settle.log.push({ date: today, dailyQuota, spentToday, unused });
    save(state);
  }
  return { date: today, dailyQuota, spentToday, unused, safe: budget.safe };
}

module.exports = {
  getProfile,
  calcBudget,
  checkBudget,
  getSpentThisMonth,
  getSpentThisMonthByCategory,
  dailySettle,
  monthlySavingsTarget,
  fixedExpenseTotal,
  todayStr,
};
