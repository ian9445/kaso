import { PRODUCT_RESULTS } from "../data.js";
import {
  getFinance,
  shoppingBudgetFor,
} from "../services/finance.js";
import { state } from "../store.js";
import {
  $,
  escapeAttr,
  escapeHtml,
  icon,
  money,
  pageTitle,
} from "../utils.js";

function render() {
  const finance = getFinance();
  const shopping = shoppingBudgetFor(finance);

  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "商品比價",
          "先確認完整型號，再比較同一個商品；未指定商品時，AI 會先追問。",
          "商品比價",
        )}
        <form id="searchForm" class="toolbar">
          <input id="searchInput" value="${escapeAttr(state.searchQuery)}" placeholder="輸入完整商品名稱，或貼上商品連結">
          <button
            id="filterToggle"
            class="filter-toggle${state.filterOpen ? " active" : ""}"
            type="button"
            aria-label="展開篩選條件"
            aria-expanded="${state.filterOpen}"
          >${icon("filter")}</button>
          <button class="primary-btn" type="submit">${icon("search")} 開始比價</button>
        </form>

        ${state.filterOpen ? `
          <div class="filter-dropdown" aria-label="商品篩選條件">
            <label>電商平台<select><option>全部平台</option><option>蝦皮</option><option>momo</option><option>PChome</option></select></label>
            <label>商品狀態<select><option>全新＋二手</option><option>只看全新</option><option>只看二手</option></select></label>
            <label>排序方式<select><option>價格最低</option><option>同品項信心最高</option></select></label>
          </div>
        ` : ""}

        <div class="summary-strip">
          <div><small>搜尋來源</small><strong>8 個平台</strong></div>
          <div><small>找到候選</small><strong>48 筆</strong></div>
          <div><small>確認同品項</small><strong>6 筆</strong></div>
          <div><small>安心可花</small><strong>${money(finance.safe)}</strong></div>
        </div>

        <div class="result-grid">
          ${PRODUCT_RESULTS.map((product) => {
            const remaining = shopping.available - product.price;
            const months = remaining >= 0
              ? 0
              : Math.ceil(Math.abs(remaining) / Math.max(1, finance.monthlySave));
            const recommended = (
              remaining >= 0
              && product.price <= shopping.available * 0.35
            );
            return `
              <article class="product-flip-card" tabindex="0" aria-label="${escapeAttr(product.title)}，滑入查看購買判斷">
                <div class="product-flip-inner">
                  <div class="product-flip-face product-flip-front">
                    <div class="product-image">${icon("phone")}</div>
                    <div class="product-body">
                      <div class="product-meta"><span class="platform">${product.platform}</span><span class="match">${product.match}</span></div>
                      <h3>${escapeHtml(state.searchQuery || product.title)}</h3>
                      <div class="product-price">${money(product.price)}</div>
                      <span class="flip-prompt">滑入查看購買判斷 →</span>
                    </div>
                  </div>
                  <div class="product-flip-face product-flip-back">
                    <div class="purchase-analysis">
                      <span class="purchase-verdict${recommended ? " ok" : ""}">${recommended ? "可以考慮購買" : "目前不建議購買"}</span>
                      <h3>${remaining >= 0 ? `買下後還剩 ${money(remaining)}` : `現在購買會不足 ${money(Math.abs(remaining))}`}</h3>
                      <p>已先排除餐飲預算 ${money(shopping.foodBudget)}，不會把吃飯的錢算進可購物金額。</p>
                    </div>
                    <div>
                      <div class="purchase-metrics">
                        <span>可用購物預算 <strong>${money(shopping.available)}</strong></span>
                        <span>目前存錢速度 <strong>${money(finance.monthlySave)}／月</strong></span>
                        <span>還要存多久 <strong>${months ? `約 ${months} 個月` : "資金已足夠"}</strong></span>
                      </div>
                      <div class="purchase-back-actions">
                        <button type="button" data-ask-product="${escapeAttr(`${product.title}｜${product.platform}｜${product.price}`)}">問 AI</button>
                        <a href="${product.link}" target="_blank" rel="noreferrer">查看來源</a>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </div>
        <p class="onboarding-note">商品、價格及連結為 HTML 介面展示；正式站的即時搜尋仍需由後端來源供應。</p>
      </section>
    </main>
  `;
}

function mount({ rerender, showToast, openAssistant }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };

  $("#searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.searchQuery = $("#searchInput").value.trim();
    if (!state.searchQuery) {
      openAssistant("我想比價");
      return;
    }
    rerender({ scroll: false });
    showToast("已用完整品名重新整理結果");
  }, options);

  $("#filterToggle")?.addEventListener("click", () => {
    state.filterOpen = !state.filterOpen;
    rerender({ scroll: false });
  }, options);

  return () => abortController.abort();
}

export default {
  render,
  mount,
};
