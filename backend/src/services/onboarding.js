// 入口層 — 判斷身分 + 算出預算。對應「入口」表格。
const { load, save, emptyExpenses, CATEGORIES } = require("../store");
const { calcBudget } = require("./budget");

// runQuiz(): 二選一問答的題目定義。身分只有兩種：月光族 / 目標計畫族。
const QUIZ = [
  {
    id: "hasGoal",
    question: "你有沒有一個具體想存錢達成的目標？（例如：買什麼、多少錢）",
    options: [
      { value: "yes", label: "有，我有明確目標" },
      { value: "no", label: "沒有，先守住月底、別花超就好" },
    ],
  },
];

function runQuiz() {
  return QUIZ;
}

// resolveProfile(答案): 答案 → 身分
function resolveProfile(answers) {
  return answers?.hasGoal === "yes" ? "goal" : "moonlight";
}

// saveProfile(): 收合 inputIncome / inputExpense / inputGoal 後存起來，並立刻算一次預算。
// 已決議：月光族不填「期望月數」— 它沒有目標，months 欄位只屬於 goal 身分。
function saveProfile(input) {
  const type = input.type === "goal" ? "goal" : "moonlight";

  const expenses = emptyExpenses();
  for (const c of CATEGORIES) {
    if (input.expenses && typeof input.expenses[c] === "number") {
      expenses[c] = input.expenses[c];
    }
  }

  const profile = {
    type,
    income: Number(input.income) || 0,
    expenses,
    currentBalance: Number(input.currentBalance) || 0,
    monthlySave: type === "moonlight" ? Number(input.monthlySave) || 0 : 0,
    goal:
      type === "goal"
        ? {
            name: input.goal?.name || "",
            amount: Number(input.goal?.amount) || 0,
            months: Number(input.goal?.months) || 1,
          }
        : null,
    updatedAt: new Date().toISOString(),
  };
  if (!profile.createdAt) profile.createdAt = profile.updatedAt;

  const state = load();
  profile.createdAt = state.profile?.createdAt || profile.updatedAt;
  state.profile = profile;
  save(state);

  return { profile, budget: calcBudget(state) };
}

module.exports = { runQuiz, resolveProfile, saveProfile };
