import { getFinance } from "../services/finance.js";
import {
  addTransaction,
  saveProfile,
  state,
} from "../store.js";
import {
  $,
  $$,
  escapeHtml,
  icon,
  money,
  monthsUntil,
  monthValueFromOffset,
  pageTitle,
  shiftMonthValue,
} from "../utils.js";

function render() {
  const finance = getFinance();
  const recovery = state.recovery
    ? `
      <div class="recovery">
        <h3>${state.recovery === "extend" ? "目標日期已延後" : "7 天低價優先已啟用"}</h3>
        <p>${
          state.recovery === "extend"
            ? "系統會把本次超支平均攤回新的期限。"
            : "商品比價與附近優惠會先顯示低實付選項。"
        }</p>
      </div>
    `
    : "";

  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "自動記帳",
          "交易通知進來後，自動分類並更新今天還能花多少。",
          "自動記帳",
        )}
        <div class="summary-strip">
          <div><small>目前餘額</small><strong>${money(finance.currentBalance)}</strong></div>
          <div><small>本月已記帳</small><strong>${money(finance.spent)}</strong></div>
          <div><small>每月先存</small><strong>${money(finance.monthlySave)}</strong></div>
          <div><small>安心可花</small><strong>${money(finance.safe)}</strong></div>
        </div>

        <div class="two-col">
          <section class="feature-card">
            <p class="eyebrow">${icon("bell")} 新增一筆</p>
            <h2>手動輸入或模擬通知</h2>
            <form id="ledgerForm" class="ledger-form">
              <input id="ledgerMerchant" placeholder="店家名稱" required>
              <input id="ledgerAmount" type="number" min="1" placeholder="金額" required>
              <select id="ledgerCategory">
                <option>餐飲</option>
                <option>日常</option>
                <option>交通</option>
                <option>娛樂</option>
              </select>
              <button class="primary-btn" type="submit">新增</button>
            </form>
            <button id="simulateMeal" class="secondary-btn" type="button" style="margin-top:10px">模擬朋友臨時約吃飯 NT$1,200</button>
            ${recovery}
            <div id="recoveryBox" class="recovery" ${state.recoveryPrompt ? "" : "hidden"}>
              <h3>今天超過預算，要怎麼補回？</h3>
              <p>由你選擇調整方式，系統不會偷偷挪動其他預算。</p>
              <div class="recovery-actions">
                <button class="secondary-btn" type="button" data-recovery="extend">延長存錢期限</button>
                <button class="primary-btn" type="button" data-recovery="low">之後優先推薦低價</button>
              </div>
            </div>
          </section>

          <section class="result-panel">
            <div class="section-head">
              <div><h2>交易紀錄</h2><p>最新交易會排在最上方。</p></div>
              <span>${state.transactions.length} 筆</span>
            </div>
            <div class="transaction-list">
              ${state.transactions.map((transaction) => `
                <div class="transaction">
                  <span>${icon(transaction.category === "餐飲" ? "food" : "cart")}</span>
                  <p>
                    <strong>${escapeHtml(transaction.merchant)}</strong>
                    <small>${escapeHtml(transaction.category)} · ${escapeHtml(transaction.time)}</small>
                  </p>
                  <strong>−${money(transaction.amount)}</strong>
                </div>
              `).join("")}
            </div>
          </section>
        </div>
      </section>
    </main>
  `;
}

function mount({ rerender, showToast }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };

  $("#ledgerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const merchant = $("#ledgerMerchant").value.trim();
    const amount = Number($("#ledgerAmount").value);
    if (!merchant || !amount) return;
    addTransaction({
      merchant,
      amount,
      category: $("#ledgerCategory").value,
      time: "剛剛",
    });
    rerender({ scroll: false });
    showToast("已新增交易並更新可花餘額");
  }, options);

  $("#simulateMeal")?.addEventListener("click", () => {
    addTransaction({
      merchant: "朋友臨時聚餐",
      amount: 1200,
      category: "餐飲",
      time: "剛剛",
    });
    state.recoveryPrompt = true;
    rerender({ scroll: false });
    showToast("已收到交易通知：NT$1,200");
  }, options);

  $$("[data-recovery]").forEach((button) => {
    button.addEventListener("click", () => {
      state.recovery = button.dataset.recovery === "extend" ? "extend" : "low";
      if (state.recovery === "extend" && state.profile) {
        const currentDeadline = state.profile.deadline
          || monthValueFromOffset(Math.max(1, Number(state.profile.months) || 1));
        const deadline = shiftMonthValue(currentDeadline, 1);
        saveProfile({
          ...state.profile,
          deadline,
          months: monthsUntil(deadline),
        });
      }
      state.recoveryPrompt = false;
      rerender({ scroll: false });
      showToast(
        state.recovery === "extend"
          ? "已延長目標期限"
          : "已啟用 7 天低價優先",
      );
    }, options);
  });

  return () => abortController.abort();
}

export default {
  render,
  mount,
};
