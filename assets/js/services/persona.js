export const PERSONA_QUESTIONS = [
  {
    id: "shopping",
    number: "01",
    question: "在蝦皮上突然看到很心動的好物",
    ariaLabel: "在蝦皮看到心動好物的選擇",
    answers: [
      { value: "buy", persona: "moonlight", label: "買" },
      { value: "skip", persona: "goal", label: "不買" },
    ],
  },
  {
    id: "salary",
    number: "02",
    question: "薪水下來了，現在該怎麼做？",
    ariaLabel: "薪水下來後的選擇",
    answers: [
      { value: "enjoy", persona: "moonlight", label: "出去爽兩頓" },
      { value: "save", persona: "goal", label: "按照計畫存一半進戶頭" },
    ],
  },
  {
    id: "travel",
    number: "03",
    question: "明年突然想出國",
    ariaLabel: "明年想出國的選擇",
    answers: [
      { value: "future", persona: "moonlight", label: "明年會有錢的" },
      { value: "start", persona: "goal", label: "該開始存了" },
    ],
  },
  {
    id: "balance",
    number: "04",
    question: "是否知道自己現在存款的具體數字？",
    ariaLabel: "是否知道具體存款數字",
    answers: [
      { value: "yes", persona: "goal", label: "是" },
      { value: "no", persona: "moonlight", label: "否" },
    ],
  },
  {
    id: "lottery",
    number: "05",
    question: "發票中了 NT$1,000，現在應該怎麼做？",
    ariaLabel: "發票中獎後的選擇",
    answers: [
      { value: "meal", persona: "moonlight", label: "可以去爽一頓" },
      { value: "deposit", persona: "goal", label: "存進去" },
    ],
  },
];

export const PERSONA_QUESTION_IDS = PERSONA_QUESTIONS.map(({ id }) => id);

export function personaModeLabel(mode) {
  return mode === "goal" ? "目標計畫族" : "月光族";
}

export function personaDescription(mode) {
  return mode === "goal"
    ? "你習慣先替未來留位置。KASO 會把目標期限放進每一次消費判斷。"
    : "你比較重視當下感受。KASO 會先幫你守住固定支出與存款，再算真正能花的金額。";
}

export function recommendedPersonaMode(answers) {
  const goalVotes = Object.values(answers)
    .filter((answer) => answer.persona === "goal")
    .length;
  return goalVotes >= 3 ? "goal" : "moonlight";
}

export function derivedQualityWeights(answers) {
  const weights = { time: 1, food: 1, comfort: 1, fun: 1 };
  const answer = (id) => answers[id]?.answer;

  if (answer("shopping") === "buy") {
    weights.comfort += 1;
    weights.fun += 2;
  } else if (answer("shopping") === "skip") {
    weights.time += 1;
  }

  if (answer("salary") === "enjoy") {
    weights.food += 2;
    weights.fun += 1;
  } else if (answer("salary") === "save") {
    weights.time += 1;
  }

  if (answer("travel") === "future") {
    weights.comfort += 1;
    weights.fun += 2;
  } else if (answer("travel") === "start") {
    weights.time += 2;
  }

  if (answer("balance") === "yes") {
    weights.time += 1;
    weights.comfort += 1;
  } else if (answer("balance") === "no") {
    weights.fun += 1;
  }

  if (answer("lottery") === "meal") {
    weights.food += 2;
    weights.fun += 1;
  } else if (answer("lottery") === "deposit") {
    weights.comfort += 1;
  }

  Object.keys(weights).forEach((key) => {
    weights[key] = Math.min(5, Math.max(1, weights[key]));
  });
  return weights;
}
