// 記帳 — P2，但是預算引擎的必要輸入（本月已花的來源）。
const { load, save, CATEGORIES } = require("../store");
const { todayStr } = require("./budget");

function listEntries(month) {
  const state = load();
  return month ? state.ledger.filter((e) => e.date.startsWith(month)) : state.ledger;
}

function addEntry({ amount, category, note, date }) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`invalid category: ${category}`);
  }
  const state = load();
  const entry = {
    id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount: Number(amount),
    category,
    note: note || "",
    date: date || todayStr(),
  };
  state.ledger.push(entry);
  save(state);
  return entry;
}

function removeEntry(id) {
  const state = load();
  const before = state.ledger.length;
  state.ledger = state.ledger.filter((e) => e.id !== id);
  save(state);
  return state.ledger.length < before;
}

module.exports = { listEntries, addEntry, removeEntry };
