import { getDailyBudget, getFinance } from "../services/finance.js";
import { personaModeLabel } from "../services/persona.js";
import { state } from "../store.js";
import {
  $,
  $$,
  icon,
  money,
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
            <summary>「安心可花」和「今日未用」有什麼不同？</summary>
            <div class="qa-answer"><p>「安心可花」是目前整月還能安排的總額；「今日未用」是今天額度扣掉今天已記帳支出後剩下的金額。</p>
            </div>
          </details>
          <details>
            <summary>為什麼「安心可花」會顯示 0 元？</summary>
            <div class="qa-answer"><p>目前餘額、固定支出或每月先存金額可能已用完可安排空間。請從「重新設定」調整收入、固定支出、存錢目標或完成月份。</p></div>
          </details>
          <details>
            <summary>記帳後，首頁數字會馬上更新嗎？</summary>
            <div class="qa-answer"><p>會。新增支出後，本月已花、安心可花、今日已花與今日未用都會立即重新計算。</p><a href="#/ledger" data-route="/ledger">前往自動記帳</a></div>
          </details>
          <details>
            <summary>固定收入或固定支出改變時怎麼辦？</summary>
            <div class="qa-answer"><p>使用頁面上方的「重新設定」，重新填寫最新收入與固定支出，首頁預算就會依新資料計算。</p></div>
          </details>
          <details>
            <summary>存錢目標和完成月份之後還能修改嗎？</summary>
            <div class="qa-answer"><p>可以。進入「重新設定」後即可調整。若設定頁的每日可安排低於 NT$1,000，也會直接提供延長月份或調整存錢目標的選項。</p></div>
          </details>
          <details>
            <summary>「今日結算」會做什麼？</summary>
            <div class="qa-answer"><p>結算後，今天尚未使用的額度會加回目前餘額，並將今日未用歸零，避免同一筆金額重複計算。</p></div>
          </details>
          <details>
            <summary>商品比價如何確認是同一項商品？</summary>
            <div class="qa-answer"><p>比價前會核對完整型號、容量、版本與商品狀況，資料不足時先追問。</p><a href="#/search" data-route="/search">前往商品比價</a></div>
          </details>
          <details>
            <summary>為什麼比價金額可能和賣場不同？</summary>
            <div class="qa-answer"><p>價格、折扣、運費與庫存可能隨時變動，購買前仍要以來源賣場的最新資訊為準。</p><a href="#/search" data-route="/search">重新查看比價結果</a></div>
          </details>
          <details>
            <summary>設定和記帳資料會同步到其他裝置嗎？</summary>
            <div class="qa-answer"><p>目前資料保存在這台裝置的瀏覽器中，不會自動同步到其他手機或電腦；更換裝置時需要重新設定。</p></div>
          </details>
          <details>
            <summary>AI 助手可以幫我做什麼？</summary>
            <div class="qa-answer"><p>可以協助解讀今日預算、整理支出習慣，以及在商品比價時說明購買後對預算的影響。</p></div>
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

  return () => {
    abortController.abort();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
  };
}

export default {
  render,
  mount,
};
