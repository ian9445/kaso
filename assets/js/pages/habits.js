import { state } from "../store.js";
import {
  escapeHtml,
  icon,
  money,
  pageTitle,
} from "../utils.js";

function render() {
  const grouped = state.transactions.reduce((result, transaction) => {
    const category = transaction.category || "其他";
    result[category] = (result[category] || 0) + Number(transaction.amount || 0);
    return result;
  }, {});
  const categories = Object.entries(grouped)
    .sort((left, right) => right[1] - left[1]);
  const total = categories.reduce((sum, entry) => sum + entry[1], 0);
  const average = state.transactions.length
    ? Math.round(total / state.transactions.length)
    : 0;
  const topCategory = categories[0]?.[0] || "尚無資料";

  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "消費習慣",
          "依自動記帳資料整理支出類別，看看錢最常花在哪裡。",
          "生活規劃",
        )}
        <div class="summary-strip">
          <div><small>本月已記帳</small><strong>${money(total)}</strong></div>
          <div><small>最多支出類別</small><strong>${escapeHtml(topCategory)}</strong></div>
          <div><small>平均每筆</small><strong>${money(average)}</strong></div>
          <div><small>記帳筆數</small><strong>${state.transactions.length} 筆</strong></div>
        </div>

        <section class="result-panel habit-panel">
          <div class="section-head">
            <div><h2>支出類別分布</h2><p>新增記帳後，比例會立即更新。</p></div>
            <button class="secondary-btn" type="button" data-route="/ledger">${icon("bell")} 新增記帳</button>
          </div>
          ${categories.length ? `
            <div class="habit-list">
              ${categories.map(([category, amount]) => {
                const percentage = total > 0
                  ? Math.round((amount / total) * 100)
                  : 0;
                return `
                  <div class="habit-row">
                    <span class="habit-icon">${icon(category === "餐飲" ? "food" : "cart")}</span>
                    <div>
                      <span><strong>${escapeHtml(category)}</strong><b>${money(amount)} · ${percentage}%</b></span>
                      <i><b style="width:${percentage}%"></b></i>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : `
            <div class="habit-empty">
              <p>還沒有記帳資料。</p>
              <button class="primary-btn" type="button" data-route="/ledger">新增第一筆支出</button>
            </div>
          `}
        </section>
      </section>
    </main>
  `;
}

export default {
  render,
};
