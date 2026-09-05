import { calculateForeignCost } from "../services/finance.js";
import {
  $,
  icon,
  money,
  pageTitle,
} from "../utils.js";

function render() {
  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "海外刷卡試算",
          "換算匯率、海外手續費與持有卡回饋後的最終成本。",
          "海外刷卡",
        )}
        <div class="two-col">
          <section class="feature-card">
            <h2>輸入消費金額</h2>
            <div class="ledger-form" style="grid-template-columns:1fr 1fr">
              <select id="currency">
                <option value="0.218">日圓 JPY</option>
                <option value="32.4">美元 USD</option>
                <option value="0.024">韓元 KRW</option>
              </select>
              <input id="foreignAmount" type="number" value="10000" min="1">
            </div>
            <button id="calculateForeign" class="primary-btn" type="button" style="margin-top:12px">重新試算</button>
          </section>
          <section class="result-panel">
            <p class="eyebrow">${icon("card")} 成本最低</p>
            <h2>台新 Richart 卡</h2>
            <div class="summary-strip" style="grid-template-columns:repeat(3,1fr)">
              <div><small>換算台幣</small><strong id="foreignTwd">NT$2,180</strong></div>
              <div><small>海外手續費</small><strong id="foreignFee">NT$33</strong></div>
              <div><small>扣除回饋後</small><strong id="foreignFinal">NT$2,141</strong></div>
            </div>
          </section>
        </div>
      </section>
    </main>
  `;
}

function mount() {
  const abortController = new AbortController();
  $("#calculateForeign")?.addEventListener("click", () => {
    const result = calculateForeignCost(
      $("#currency").value,
      $("#foreignAmount").value,
    );
    $("#foreignTwd").textContent = money(result.twd);
    $("#foreignFee").textContent = money(result.fee);
    $("#foreignFinal").textContent = money(result.final);
  }, { signal: abortController.signal });
  return () => abortController.abort();
}

export default {
  render,
  mount,
};
