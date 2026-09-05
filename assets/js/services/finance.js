import { state } from "../store.js";
import {
  monthValueFromOffset,
  monthsUntil,
  remainingDaysInMonth,
} from "../utils.js";

const DEFAULT_PROFILE = {
  currentBalance: 6800,
  income: 30000,
  fixed: 24000,
  target: 12000,
  months: 6,
  quality: { time: 1, food: 1, comfort: 1, fun: 1 },
};

export function getFinance() {
  const profile = state.profile || DEFAULT_PROFILE;
  const deadline = profile.deadline
    || monthValueFromOffset(Math.max(1, Number(profile.months) || 1));
  const months = profile.deadline
    ? monthsUntil(profile.deadline)
    : Math.max(1, Number(profile.months) || 1);
  const monthlySave = Math.ceil(profile.target / months);
  const flexible = Math.max(0, profile.income - profile.fixed - monthlySave);
  const spent = state.transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0,
  );
  const newSpending = state.transactions
    .filter((transaction) => !transaction.includedInBalance)
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0,
    );
  const currentBalance = Math.max(
    0,
    Number(profile.currentBalance || 0) - newSpending,
  );
  const remainingFlexible = Math.max(0, flexible - newSpending);
  const safe = Math.max(
    0,
    Math.min(currentBalance, remainingFlexible),
  );

  return {
    ...profile,
    deadline,
    months,
    currentBalance,
    monthlySave,
    flexible,
    spent,
    newSpending,
    safe,
    reserve: profile.fixed + monthlySave,
  };
}

function isTodayTransaction(transaction) {
  if (transaction.day) return transaction.day === "today";
  return /^(今天|剛剛)/.test(String(transaction.time || ""));
}

export function getDailyBudget(finance = getFinance(), now = new Date()) {
  const todaySpent = state.transactions
    .filter(isTodayTransaction)
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0,
    );
  const remainingDays = remainingDaysInMonth(now);
  const availableAtStartOfDay = Math.max(0, finance.safe + todaySpent);
  const allowance = Math.floor(availableAtStartOfDay / remainingDays);
  const unused = Math.max(
    0,
    Math.min(finance.safe, allowance - todaySpent),
  );
  const overspent = Math.max(0, todaySpent - allowance);

  return {
    allowance,
    spent: todaySpent,
    unused,
    overspent,
    remainingDays,
  };
}

export function shoppingBudgetFor(finance = getFinance()) {
  const quality = finance.quality || DEFAULT_PROFILE.quality;
  const rawTotal = (
    quality.time * 1.35
    + quality.food * 1.15
    + quality.comfort
    + quality.fun * 0.75
  );
  const foodPercent = rawTotal > 0
    ? ((quality.food * 1.15) / rawTotal) * 0.62
    : 0.18;
  const foodBudget = Math.max(0, Math.round(finance.safe * foodPercent));
  return {
    foodBudget,
    available: Math.max(0, finance.safe - foodBudget),
  };
}

export function calculateForeignCost(rate, amount) {
  const twd = Number(rate || 0) * Number(amount || 0);
  const fee = twd * 0.015;
  const final = twd + fee - twd * 0.033;
  return { twd, fee, final };
}
