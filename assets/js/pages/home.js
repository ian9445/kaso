import { getDailyBudget, getFinance } from "../services/finance.js";
import { personaModeLabel } from "../services/persona.js";
import { saveProfile, state } from "../store.js";
import {
  $,
  $$,
  formatMonthValue,
  icon,
  money,
  monthsUntil,
  monthValueFromOffset,
  shiftMonthValue,
} from "../utils.js";

function budgetPill(id, label, value) {
  return `
    <button class="spend-pill${state.budgetDetail === id ? " active" : ""}" type="button" data-budget-detail="${id}">
      <span class="plus">+</span>
      <span><strong>${label}</strong><small>${value}</small></span>
    </button>
  `;
}

function percentOf(value, total) {
  if (total <= 0 || value <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function spendingLines(finance) {
  const groups = state.transactions.reduce((result, transaction) => {
    const label = transaction.category === "日常"
      ? "日常採買"
      : transaction.category === "餐飲"
        ? "餐飲咖啡"
        : "其他支出";
    result[label] = (result[label] || 0) + Number(transaction.amount || 0);
    return result;
  }, {});

  return Object.entries(groups)
    .map(([label, amount]) => [label, percentOf(amount, finance.spent), amount])
    .sort((left, right) => right[2] - left[2]);
}

function budgetDetailData(finance, id) {
  const savingProgress = finance.target > 0
    ? Math.min(100, Math.round((finance.monthlySave / finance.target) * 100))
    : 0;
  const daily = getDailyBudget(finance);
  const todayAllowance = Math.min(finance.safe, daily.allowance);
  const dailyResultLabel = daily.overspent > 0 ? "今日超支" : "今日未用";
  const dailyResultAmount = daily.overspent > 0
    ? daily.overspent
    : daily.unused;
  const details = {
    fixed: {
      kicker: "每月必要保留",
      amount: finance.fixed,
      title: "固定支出",
      copy: "房租、帳單與必要支出先保留，不會出現在可花預算裡。",
      glow: "rgba(0,113,227,.30)",
      lines: [
        ["固定帳單", 72, finance.fixed * 0.72],
        ["交通通訊", 18, finance.fixed * 0.18],
        ["其他必要", 10, finance.fixed * 0.1],
      ],
    },
    saving: {
      kicker: "存款目標進度",
      amount: finance.monthlySave,
      title: "本月先存",
      copy: `目標 ${money(finance.target)}，目前已完成 ${savingProgress}%。`,
      glow: "rgba(109,74,255,.42)",
      lines: [["目標進度", savingProgress, finance.monthlySave]],
    },
    spent: {
      kicker: "交易自動分類",
      amount: finance.spent,
      title: "本月已記帳",
      copy: "點開交易紀錄，可查看餐飲、日常與其他分類的每一筆明細。",
      glow: "rgba(8,120,223,.42)",
      lines: spendingLines(finance),
    },
    safe: {
      kicker: "扣除每月保留後",
      amount: finance.safe,
      title: "安心可花",
      copy: `收入 ${money(finance.income)}－固定支出 ${money(finance.fixed)}－每月先存 ${money(finance.monthlySave)}；目前可安排 ${money(finance.safe)}。今日額度 ${money(daily.allowance)}，已花 ${money(daily.spent)}。`,
      glow: "rgba(184,255,61,.28)",
      lines: [
        ["本月可安排", finance.safe > 0 ? 100 : 0, finance.safe],
        ["今日額度", percentOf(todayAllowance, finance.safe), todayAllowance],
        [dailyResultLabel, percentOf(dailyResultAmount, daily.allowance), dailyResultAmount],
      ],
    },
  };
  return details[id] || details.safe;
}

function budgetDetailMarkup(finance, id) {
  const detail = budgetDetailData(finance, id);
  const detailIcon = id === "saving"
    ? "target"
    : id === "spent"
      ? "bell"
      : "wallet";
  return `
    <span class="detail-kicker">${icon(detailIcon)} ${detail.kicker}</span>
    <div class="detail-amount">${money(detail.amount)}</div>
    <h2 class="detail-title">${detail.title}</h2>
    <p class="detail-copy">${detail.copy}</p>
    <div class="detail-lines">
      ${detail.lines.map(([label, width, amount]) => `
        <div class="detail-line">
          <span>${label}</span>
          <i style="--line-width:${amount > 0 ? Math.min(100, Math.max(3, width)) : 0}%;--line-color:${
            id === "saving" ? "#2f5fd0" : id === "safe" ? "#f4d400" : "#94a79b"
          }"></i>
          <strong>${money(amount)} · ${Math.round(width)}%</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function render() {
  const finance = getFinance();
  const daily = getDailyBudget(finance);
  const carryover = daily.unused;
  const settledCarryover = state.settlementDone
    ? state.settledCarryoverAmount
    : 0;
  const dailyIsOver = !state.settlementDone && daily.overspent > 0;
  const dailyDisplayAmount = dailyIsOver ? daily.overspent : carryover;
  const dailyDisplayLabel = dailyIsOver ? "今日超支" : "今日未用";
  const total = Math.max(
    finance.reserve + finance.spent + finance.safe + settledCarryover,
    1,
  );
  const reserveStop = (finance.fixed / total) * 100;
  const saveStop = reserveStop + (finance.monthlySave / total) * 100;
  const spentStop = Math.min(
    100,
    saveStop + (finance.spent / total) * 100,
  );
  const donutBackground = `conic-gradient(
    #0b0b0b 0 ${reserveStop}%,
    #2f5fd0 ${reserveStop}% ${saveStop}%,
    #94a79b ${saveStop}% ${spentStop}%,
    #f4d400 ${spentStop}% 100%
  )`;
  const status = finance.safe > 3000
    ? "今天有一點彈性"
    : "今天需要注意";
  const displayBalance = finance.currentBalance + settledCarryover;
  const needsExtension = (
    state.profile?.mode === "goal"
    && daily.allowance < 1000
  );
  const savingProgress = finance.target > 0
    ? Math.min(100, Math.round((finance.monthlySave / finance.target) * 100))
    : 0;

  return `
    <main class="shell main-content">
      <section class="view money-overview dashboard-stage">
        <div class="balance-stage-head">
          <div>
            <p class="eyebrow">${icon("wallet")} ${personaModeLabel(state.profile?.mode)}首頁</p>
            <h1>${status}</h1>
          </div>
          <div class="money-actions">
            <button type="button" data-route="/ledger">${icon("bell")} 查看記帳</button>
            <div
              id="dailyPocket"
              class="daily-compact${state.settlementDone ? " is-done" : ""}${dailyIsOver ? " is-over" : ""}"
              title="今日額度 ${money(daily.allowance)}，減去今日已記帳 ${money(daily.spent)}"
              aria-label="今日額度 ${money(daily.allowance)}，今日已花 ${money(daily.spent)}，${dailyDisplayLabel} ${money(state.settlementDone ? 0 : dailyDisplayAmount)}"
            >
              <span>
                <small>${dailyDisplayLabel}</small>
                <strong id="dailyCarryoverAmount">${money(state.settlementDone ? 0 : dailyDisplayAmount)}</strong>
                <small class="daily-formula">${state.settlementDone
                  ? `已結算 ${money(settledCarryover)}`
                  : `額度 ${money(daily.allowance)} − 已花 ${money(daily.spent)}`}</small>
              </span>
              <button id="settleDaily" type="button" ${state.settlementDone || carryover <= 0 ? "disabled" : ""}>
                ${state.settlementDone ? "已結算" : dailyIsOver ? "已超支" : "結算"}
              </button>
            </div>
          </div>
        </div>

        <div class="balance-stage-grid">
          <nav class="spend-rail" aria-label="花費分類明細">
            <small>按下分類放大檢視</small>
            ${budgetPill("fixed", "固定支出", `${Math.round((finance.fixed / total) * 100)}%`)}
            ${budgetPill("saving", "存款目標", `${savingProgress}%`)}
            ${budgetPill("spent", "本月已花", `${Math.round((finance.spent / total) * 100)}%`)}
            ${budgetPill("safe", "安心可花", `${Math.round((finance.safe / total) * 100)}%`)}
          </nav>

          <section
            id="spendDetail"
            class="spend-detail"
            style="--detail-glow:${budgetDetailData(finance, state.budgetDetail).glow}"
            aria-live="polite"
          >
            <div id="spendDetailContent" class="spend-detail-content">
              ${budgetDetailMarkup(finance, state.budgetDetail)}
            </div>
          </section>

          <aside id="balanceDonut" class="donut-side">
            <small>每月資金配置</small>
            <div class="donut large" style="background:${donutBackground}">
              <span><small>目前餘額</small><strong id="balanceAmountDisplay">${money(displayBalance)}</strong></span>
            </div>
            <div class="legend">
              <span><i class="legend-fixed"></i>固定</span>
              <span><i class="legend-saving"></i>存款</span>
              <span><i class="legend-spent"></i>已花</span>
              <span><i class="legend-available"></i>可花</span>
            </div>
            <span class="status-pill">${finance.safe > 3000 ? "可以稍微放鬆" : "支出要收斂"}</span>
          </aside>
        </div>

        ${needsExtension ? `
          <div class="zero-balance-card">
            <p>
              <strong>每日可安排 ${money(daily.allowance)}，建議延後完成月份</strong>
              <small>目前低於 NT$1,000；延長一個月可降低每月需要先存的金額。</small>
            </p>
            <button id="delayGoal" class="primary-btn" type="button">延後 1 個月</button>
          </div>
        ` : ""}
      </section>

      <section class="view qa-section" aria-labelledby="qaTitle">
        <div class="qa-title">
          <p class="eyebrow">${icon("grid")} KASO 使用說明</p>
          <h2 id="qaTitle">有問？有答。</h2>
        </div>
        <div class="qa-list">
          <details>
            <summary>怎麼知道今天還能花多少？</summary>
            <div class="qa-answer"><p>系統會先保留固定支出與存款，再把安心可花依本月剩餘天數換算成今日額度，扣除今天的記帳後得到「今日未用」。</p><a href="#/ledger" data-route="/ledger">查看自動記帳</a></div>
          </details>
          <details>
            <summary>餘額不夠時怎麼處理？</summary>
            <div class="qa-answer"><p>當可花餘額歸零或不足，會先建議延後目標期限，讓每月需要保留的金額下降。</p><a href="#/ledger" data-route="/ledger">查看支出與調整方案</a></div>
          </details>
          <details>
            <summary>商品比價如何確認是同一項商品？</summary>
            <div class="qa-answer"><p>比價前會核對完整型號、容量、版本與商品狀況，資料不足時先追問。</p><a href="#/search" data-route="/search">前往商品比價</a></div>
          </details>
          <details>
            <summary>完成月份太近時怎麼調整？</summary>
            <div class="qa-answer"><p>目標計畫族若每日可安排低於 NT$1,000，系統會提醒延後完成月份，讓每月存款壓力下降。也可以使用頁面上方的「重新設定」調整。</p></div>
          </details>
        </div>
      </section>
    </main>
  `;
}

function mount({ rerender, showToast }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };
  let animationFrame = null;

  $$("[data-budget-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.budgetDetail;
      state.budgetDetail = id;
      const finance = getFinance();
      const detail = budgetDetailData(finance, id);
      $$("[data-budget-detail]").forEach((item) => {
        item.classList.toggle("active", item.dataset.budgetDetail === id);
      });
      const panel = $("#spendDetail");
      const content = $("#spendDetailContent");
      if (!panel || !content) return;
      panel.style.setProperty("--detail-glow", detail.glow);
      content.innerHTML = budgetDetailMarkup(finance, id);
      content.classList.remove("is-changing");
      window.requestAnimationFrame(() => content.classList.add("is-changing"));
    }, options);
  });

  $("#settleDaily")?.addEventListener("click", () => {
    const button = $("#settleDaily");
    const sourceAmount = $("#dailyCarryoverAmount");
    const balanceAmount = $("#balanceAmountDisplay");
    if (!button || !sourceAmount || !balanceAmount || state.settlementDone) return;

    const finance = getFinance();
    const carryover = getDailyBudget(finance).unused;
    if (carryover <= 0) return;
    button.disabled = true;
    button.textContent = "結算中";
    const startBalance = finance.currentBalance;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 1050;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const moved = Math.round(carryover * eased);
      sourceAmount.textContent = money(carryover - moved);
      balanceAmount.textContent = money(startBalance + moved);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }
      state.settlementDone = true;
      state.settledCarryoverAmount = carryover;
      rerender({ scroll: false });
      showToast("今日未用預算已加回目前餘額");
    };
    animationFrame = window.requestAnimationFrame(tick);
  }, options);

  $("#delayGoal")?.addEventListener("click", () => {
    if (!state.profile) return;
    const currentDeadline = state.profile.deadline
      || monthValueFromOffset(Math.max(1, Number(state.profile.months) || 1));
    const deadline = shiftMonthValue(currentDeadline, 1);
    saveProfile({
      ...state.profile,
      deadline,
      months: monthsUntil(deadline),
    });
    rerender({ scroll: false });
    showToast(`已將完成月份延後至 ${formatMonthValue(deadline)}`);
  }, options);

  return () => {
    abortController.abort();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
  };
}

export default {
  render,
  mount,
};
