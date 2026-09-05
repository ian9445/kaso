import { NEARBY_OFFERS } from "../data.js";
import { getDailyBudget, getFinance } from "../services/finance.js";
import { addMessage, state } from "../store.js";
import { $, escapeHtml, icon, money } from "../utils.js";

export function assistantMarkup() {
  return `
    <button id="assistantFab" class="assistant-fab" type="button">
      ${icon("bot")} 問 KASO AI
    </button>
    <aside id="assistantPanel" class="assistant-panel" hidden aria-label="KASO AI 助手">
      <div class="assistant-head">
        <span>
          ${icon("bot")}
          <span>
            <strong>KASO AI 助手</strong>
            <small id="assistantContext">延續目前問題 · HTML 互動稿</small>
          </span>
        </span>
        <button id="assistantClose" type="button" aria-label="關閉">${icon("x")}</button>
      </div>
      <div id="chatLog" class="chat-log" aria-live="polite"></div>
      <form id="assistantForm" class="assistant-form">
        <input id="assistantInput" autocomplete="off" placeholder="問預算、商品、附近優惠或消費習慣…" aria-label="輸入問題">
        <button type="submit" aria-label="送出">${icon("send")}</button>
      </form>
    </aside>
  `;
}

function renderMessages() {
  const log = $("#chatLog");
  if (!log) return;
  log.innerHTML = state.messages
    .map((message) => `<div class="bubble ${message.role}">${escapeHtml(message.text)}</div>`)
    .join("");
  log.scrollTop = log.scrollHeight;
}

function appendMessage(role, text) {
  addMessage({ role, text });
  renderMessages();
}

function assistantReply(text) {
  const question = text.toLowerCase();
  const finance = getFinance();
  const daily = getDailyBudget(finance);

  if (
    /消費習慣|支出分類|花最多|常買|記帳/.test(question)
    || state.assistantTopic === "habits"
  ) {
    state.assistantTopic = "habits";
    const grouped = state.transactions.reduce((result, transaction) => {
      const category = transaction.category || "其他";
      result[category] = (result[category] || 0) + Number(transaction.amount || 0);
      return result;
    }, {});
    const categories = Object.entries(grouped)
      .sort((left, right) => right[1] - left[1]);
    const total = categories.reduce((sum, entry) => sum + entry[1], 0);
    if (!categories.length) {
      return "目前還沒有記帳資料。先新增一筆支出，我就能開始整理你的消費習慣。";
    }
    const [topCategory, topAmount] = categories[0];
    const percentage = total > 0 ? Math.round((topAmount / total) * 100) : 0;
    return `目前記帳中以「${topCategory}」最多，共 ${money(topAmount)}，約占 ${percentage}%。新增更多記帳後，判斷會一起更新。`;
  }

  if (/還能花|剩多少|預算|餘額/.test(question)) {
    state.assistantTopic = "budget";
    return daily.overspent > 0
      ? `目前餘額 ${money(finance.currentBalance)}；今天額度 ${money(daily.allowance)}，已記帳 ${money(daily.spent)}，目前已超支 ${money(daily.overspent)}。`
      : `目前餘額 ${money(finance.currentBalance)}；今天額度 ${money(daily.allowance)}，已記帳 ${money(daily.spent)}，所以今日未用是 ${money(daily.unused)}。`;
  }

  if (/商品|買|比價|多少錢|連結|http/.test(question) || state.assistantTopic === "product") {
    state.assistantTopic = "product";
    const hasSpecific = /airpods|iphone|switch|macbook|http|https|型號|gb/i.test(question);
    return hasSpecific
      ? `我會以你指定的商品繼續比較。請確認容量、顏色、新品／二手與公司貨版本；目前安心可花是 ${money(finance.safe)}。`
      : "你想找哪一個商品？請貼商品名稱、完整型號或連結；資料不足時我會先追問，不會自己猜一個商品。";
  }

  if (/附近|餐廳|咖啡|超市/.test(question)) {
    state.assistantTopic = "nearby";
    return `目前以台北車站 1,000 公尺為示範位置，共有 ${NEARBY_OFFERS.length} 個預算內選項；要我優先找餐飲、日常採買，還是免費活動？`;
  }

  return state.assistantTopic
    ? "我會延續上一個主要問題。可以再補充你剛才回答的是哪個條件，或直接貼相關連結，我就接著整理。"
    : "我還不知道你要處理的是商品、預算、附近優惠或消費習慣。請多給我一個關鍵資訊，我會先確認再回答。";
}

export function openAssistant(prefill = "") {
  const panel = $("#assistantPanel");
  const launcher = $("#assistantFab");
  if (!panel || !launcher) return;

  panel.hidden = false;
  launcher.hidden = true;
  renderMessages();
  if (prefill) {
    const input = $("#assistantInput");
    input.value = prefill;
    input.focus();
  }
}

export function askProduct(detail) {
  openAssistant();
  const [title, platform, rawPrice] = detail.split("｜");
  const price = Number(rawPrice || 0);
  const finance = getFinance();
  state.assistantTopic = "product";
  appendMessage("user", `請幫我看這個商品：${title}`);
  appendMessage(
    "ai",
    `${platform ? `這筆是 ${platform} 的` : "這個"} ${title}，價格 ${price ? money(price) : "尚未提供"}。${
      price > finance.safe
        ? `它比你目前安心可花的 ${money(finance.safe)} 高，建議先加入目標，不要直接刷卡。`
        : `買下後約剩 ${money(finance.safe - price)} 可花。`
    }\n你也可以貼商品連結，我會沿用這個商品繼續問。`,
  );
}

export function updateAssistantContext(label) {
  const context = $("#assistantContext");
  if (context) context.textContent = `${label} · 延續目前問題 · HTML 互動稿`;
}

export function setAssistantEnabled(enabled) {
  const launcher = $("#assistantFab");
  const panel = $("#assistantPanel");
  if (!launcher || !panel) return;
  if (!enabled) {
    launcher.hidden = true;
    panel.hidden = true;
    return;
  }
  if (panel.hidden) launcher.hidden = false;
}

export function mountAssistant() {
  $("#assistantFab")?.addEventListener("click", () => openAssistant());
  $("#assistantClose")?.addEventListener("click", () => {
    $("#assistantPanel").hidden = true;
    $("#assistantFab").hidden = false;
  });
  $("#assistantForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#assistantInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    appendMessage("user", text);
    window.setTimeout(() => appendMessage("ai", assistantReply(text)), 260);
  });
  renderMessages();
}
