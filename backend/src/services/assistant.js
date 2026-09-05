// KASO AI — 串 Claude API。API key 只放在後端的環境變數，前端拿不到、也不會經過前端。
const { getProfile, calcBudget, getSpentThisMonthByCategory } = require("./budget");
const { CATEGORY_LABEL, CATEGORIES } = require("../store");

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_HISTORY = 12;
const MAX_TOKENS = 1024; // 之前設 500 太小，遇到「延後幾個月／砍幾%」這種條列式回答會被硬切斷

function buildSystemPrompt() {
  const profile = getProfile();
  const budget = calcBudget();

  let context = "使用者還沒有完成 KASO 的入口設定，還沒有預算資料。";
  if (profile && budget) {
    const categoryLines = CATEGORIES.map((c) => {
      const spent = getSpentThisMonthByCategory(c);
      return `${CATEGORY_LABEL[c]}：預算 ${profile.expenses[c]}，本月已花 ${spent}`;
    }).join("；");
    context = [
      `身分：${profile.type === "goal" ? "目標計畫族" : "月光族"}`,
      `目前餘額：${budget.currentBalance}`,
      `固定支出（食衣住行育樂總和）：${budget.fixedExpense}`,
      `每月存款目標：${budget.savingsGoal}`,
      `本月已花：${budget.spentThisMonth}`,
      `安心可花：${budget.safe}`,
      profile.goal ? `目標：${profile.goal.name}，金額 ${profile.goal.amount}，期望 ${profile.goal.months} 個月完成` : null,
      `各分類明細：${categoryLines}`,
    ].filter(Boolean).join("\n");
  }

  return `你是「KASO AI」，KASO 卡搜這個記帳／消費決策 App 裡的助手。KASO 的核心規則：
- 使用者身分只有兩種：月光族、目標計畫族。身分只改「怎麼呈現」，不改「資料從哪來」。
- 「安心可花」= 目前餘額 − 固定支出 − 存款目標 − 本月已花，是唯一的判定基準。
- 月光族：超出安心可花時系統會建議延後購買、列出買得起的替代品。
- 目標計畫族：不擋，只換算「維持開支會delay幾個月」或「想準時要砍幾%支出」。

使用者目前的即時財務狀況：
${context}

請根據以上資料，用繁體中文回答，語氣像貼身理財助理。預設精簡（2-4 句），但如果使用者的情境需要列出多個要點或分項比較（例如「delay 幾個月」vs「砍幾% 支出」這種兩個方案的計算），要用條列式把每一項都講完整，不要中途省略或截斷。不要幫使用者做投資或信用卡核卡承諾，也不要編造上面沒有提到的具體數字。`;
}

async function chat(message, history = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("尚未設定 ANTHROPIC_API_KEY，請在 backend/.env 加入你的 Claude API key（可參考 backend/.env.example）。");
    err.code = "NO_API_KEY";
    throw err;
  }

  const messages = [
    ...history
      .filter((m) => m.role === "user" || m.role === "ai")
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
    { role: "user", content: message },
  ];

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Claude API error ${res.status}: ${body}`);
    err.code = "ANTHROPIC_ERROR";
    throw err;
  }

  const data = await res.json();
  const reply = data.content?.map((c) => c.text).join("") || "";
  return reply;
}

module.exports = { chat };
