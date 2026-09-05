export const PROFILE_STORAGE_KEY = "kaso-html-profile-v4";
export const ACCOUNT_STORAGE_KEY = "kaso-html-account";
export const FEEDBACK_STORAGE_KEY = "kaso-html-feedback";

const DEFAULT_MESSAGES = [
  {
    role: "ai",
    text: "嗨，我會記住這段對話的主要問題。你可以問我：今天還能花多少、支出最多在哪一類，或貼商品連結一起比較。",
  },
];

export const state = {
  mode: "moonlight",
  personaAnswers: {},
  quizIndex: 0,
  quizTimer: null,
  profile: null,
  searchQuery: "Apple AirPods Pro 2 USB-C",
  searchCategory: "商品",
  transactions: [
    { merchant: "北車慢慢咖啡", amount: 130, category: "餐飲", time: "今天 15:35", day: "today", includedInBalance: true },
    { merchant: "全聯 台北站前店", amount: 428, category: "日常", time: "昨天 19:12", day: "yesterday", includedInBalance: true },
  ],
  recovery: null,
  recoveryPrompt: false,
  budgetDetail: "safe",
  settlementDone: false,
  settledCarryoverAmount: 0,
  filterOpen: false,
  assistantTopic: null,
  messages: DEFAULT_MESSAGES.map((message) => ({ ...message })),
};

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage can be blocked in strict privacy modes.
    }
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStoredValue(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Keep the in-memory experience usable when storage is unavailable.
  }
}

function isValidProfile(profile) {
  const questionIds = ["shopping", "salary", "travel", "balance", "lottery"];
  const validMode = profile?.mode === "moonlight" || profile?.mode === "goal";
  const completeQuiz = questionIds.every((id) => profile?.personaAnswers?.[id]);
  return Boolean(validMode && completeQuiz);
}

export function hydrateProfile() {
  const profile = readJson(PROFILE_STORAGE_KEY);
  if (!isValidProfile(profile)) {
    if (profile) removeStoredValue(PROFILE_STORAGE_KEY);
    state.profile = null;
    return null;
  }

  state.profile = profile;
  state.mode = profile.mode;
  state.personaAnswers = { ...profile.personaAnswers };
  return profile;
}

export function saveProfile(profile) {
  state.profile = profile;
  state.mode = profile.mode;
  state.personaAnswers = { ...profile.personaAnswers };
  writeJson(PROFILE_STORAGE_KEY, profile);
}

export function clearProfile() {
  removeStoredValue(PROFILE_STORAGE_KEY);
  state.profile = null;
  state.mode = "moonlight";
  state.personaAnswers = {};
  state.quizIndex = 0;
  state.settlementDone = false;
  state.settledCarryoverAmount = 0;
}

export function resetQuizState() {
  window.clearTimeout(state.quizTimer);
  state.mode = "moonlight";
  state.personaAnswers = {};
  state.quizIndex = 0;
}

export function getAccount() {
  return readJson(ACCOUNT_STORAGE_KEY);
}

export function saveAccount(account) {
  writeJson(ACCOUNT_STORAGE_KEY, account);
}

export function clearAccount() {
  removeStoredValue(ACCOUNT_STORAGE_KEY);
}

export function saveFeedback(feedback) {
  writeJson(FEEDBACK_STORAGE_KEY, feedback);
}

export function addTransaction(transaction) {
  state.transactions.unshift({
    day: "today",
    includedInBalance: false,
    ...transaction,
  });
  state.settlementDone = false;
  state.settledCarryoverAmount = 0;
}

export function addMessage(message) {
  state.messages.push(message);
}
