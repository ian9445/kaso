import {
  daysInMonth,
  monthValueFromOffset,
  monthsUntil,
} from "../utils.js";

export const DAILY_BUDGET_ADVICE_THRESHOLD = 200;

function nonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

export function calculateBudgetPlan(profile = {}, now = new Date()) {
  const currentBalance = nonNegativeNumber(profile.currentBalance);
  const income = nonNegativeNumber(profile.income);
  const fixed = nonNegativeNumber(profile.fixed);
  const target = nonNegativeNumber(profile.target);
  const fallbackMonths = Math.max(1, Number(profile.months) || 1);
  const deadline = profile.deadline
    || monthValueFromOffset(fallbackMonths, now);
  const months = profile.deadline
    ? monthsUntil(profile.deadline, now)
    : fallbackMonths;

  const remainingGoal = Math.max(0, target - currentBalance);
  const monthlySave = Math.ceil(remainingGoal / months);
  const monthlyAvailable = Math.max(0, income - fixed - monthlySave);
  const dailyAvailable = Math.floor(monthlyAvailable / daysInMonth(now));

  return {
    deadline,
    months,
    remainingGoal,
    monthlySave,
    monthlyAvailable,
    dailyAvailable,
  };
}
