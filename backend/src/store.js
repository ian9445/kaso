const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "store.json");

const CATEGORIES = ["food", "clothing", "housing", "transport", "education", "entertainment"];
const CATEGORY_LABEL = {
  food: "食", clothing: "衣", housing: "住",
  transport: "行", education: "育", entertainment: "樂",
};

function emptyExpenses() {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
}

function defaultState() {
  return {
    profile: null, // { type: 'moonlight'|'goal', income, expenses{}, monthlySave, goal, currentBalance, createdAt, updatedAt }
    ledger: [], // { id, amount, category, note, date }
    settle: { lastSettleDate: null, log: [] },
  };
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    save(defaultState());
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}

function save(state) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

module.exports = { load, save, defaultState, emptyExpenses, CATEGORIES, CATEGORY_LABEL };
