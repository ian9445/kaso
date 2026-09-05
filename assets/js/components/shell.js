import { MEGA_CONTENT } from "../data.js";
import { getFinance } from "../services/finance.js";
import { personaModeLabel } from "../services/persona.js";
import { clearProfile, state } from "../store.js";
import { $, $$, escapeAttr, icon, money } from "../utils.js";
import {
  askProduct,
  assistantMarkup,
  mountAssistant,
  setAssistantEnabled,
  updateAssistantContext,
} from "./assistant.js";
import {
  dialogsMarkup,
  mountDialogs,
  showToast,
} from "./dialogs.js";

const ICON_SPRITE = `
  <svg id="kasoIconSprite" class="sr-only" aria-hidden="true" focusable="false">
    <symbol id="i-grid" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor"></path></symbol>
    <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M3 7h16a2 2 0 0 1 2 2v9H3zM3 7V5a2 2 0 0 1 2-2h12M15 12h6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></symbol>
    <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"></circle><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor"></circle><path d="m15 9 5-5M17 4h3v3" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-card" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor"></rect><path d="M3 10h18M7 15h3" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor"></circle><path d="m16 16 5 5" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" fill="none" stroke="currentColor"></path><circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor"></circle></symbol>
    <symbol id="i-bot" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="3" fill="none" stroke="currentColor"></rect><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.4 8.2 8 9.5 4.6-1.3 8-4.5 8-9.5V6z" fill="none" stroke="currentColor"></path><path d="m8.5 12 2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-plane" viewBox="0 0 24 24"><path d="m21 16-8-4V5.5a1.5 1.5 0 0 0-3 0V12l-8 4v2l8-2v4l-2 1v1l3.5-.5L15 22v-1l-2-1v-4l8 2z" fill="none" stroke="currentColor" stroke-linejoin="round"></path></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor"></circle><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-food" viewBox="0 0 24 24"><path d="M7 3v7M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 1 4 4 4 7h-4" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-cart" viewBox="0 0 24 24"><path d="M3 4h2l2 11h10l3-8H6M9 20h.01M17 20h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></symbol>
    <symbol id="i-monitor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2" fill="none" stroke="currentColor"></rect><path d="M8 21h8M12 17v4" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-send" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4zM22 2 11 13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2" fill="none" stroke="currentColor"></rect><path d="M10 18h4" fill="none" stroke="currentColor" stroke-linecap="round"></path></symbol>
    <symbol id="i-music" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13M9 8l11-2" fill="none" stroke="currentColor"></path><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor"></circle><circle cx="17" cy="16" r="3" fill="none" stroke="currentColor"></circle></symbol>
  </svg>
`;

function globalUiMarkup() {
  return `
    <div id="globalUi">
      ${assistantMarkup()}
      ${dialogsMarkup()}
    </div>
  `;
}

function syncFinanceHeader() {
  const finance = getFinance();
  const isGoal = state.profile?.mode === "goal";
  $("#headGoal").hidden = !isGoal;
  $("#headGoalName").textContent = isGoal
    ? `存 ${money(finance.target)}`
    : "存款計畫";
  $("#headReserve").textContent = money(finance.reserve);
  $("#headSafe").textContent = money(finance.safe);
  $("#resetProfile").title = `目前為${personaModeLabel(state.profile?.mode)}，按下重新設定`;
}

function setActiveNavigation(navGroup) {
  $$(".nav-btn").forEach((button) => {
    const isActive = button.dataset.nav === navGroup;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function showMegaMenu(key) {
  const menu = $("#megaMenu");
  const columns = MEGA_CONTENT[key];
  if (!menu || !columns) return;

  const actions = columns.flatMap((column) => column[1]);
  menu.innerHTML = `
    <div class="shell feature-mega-grid">
      ${actions.map((label) => `
        <button type="button" data-mega-action="${escapeAttr(label)}">${label}</button>
      `).join("")}
    </div>
  `;
  menu.hidden = false;
}

function hideMegaMenu() {
  const menu = $("#megaMenu");
  if (menu) menu.hidden = true;
}

function routeForMegaAction(label) {
  if (label === "一般商品") {
    state.searchCategory = "商品";
    return "/search";
  }
  if (label === "日常採買") {
    state.searchCategory = "日常";
    return "/search";
  }
  if (label === "3C 家電") {
    state.searchCategory = "3C 家電";
    return "/search";
  }
  if (label === "消費習慣") return "/habits";
  if (label === "支出與目標進度") {
    state.budgetDetail = "spent";
    return "/home";
  }
  if (/海外/.test(label)) return "/overseas";
  if (/記帳/.test(label)) return "/ledger";
  if (/附近|文化幣|免費活動|公尺|店家/.test(label)) return "/nearby";
  return "/search";
}

function closeOpenOverlays() {
  hideMegaMenu();
}

export function mountShell({ navigate }) {
  if (!$("#kasoIconSprite")) {
    document.body.insertAdjacentHTML("afterbegin", ICON_SPRITE);
  }
  if (!$("#globalUi")) {
    document.body.insertAdjacentHTML("beforeend", globalUiMarkup());
  }

  mountAssistant();
  mountDialogs({
    onResetProfile: () => {
      clearProfile();
      navigate("/onboarding");
    },
  });

  document.addEventListener("click", (event) => {
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      event.preventDefault();
      closeOpenOverlays();
      navigate(routeTarget.dataset.route);
      return;
    }

    const productTarget = event.target.closest("[data-ask-product]");
    if (productTarget) {
      event.preventDefault();
      askProduct(productTarget.dataset.askProduct);
    }
  });

  $("#resetProfile")?.addEventListener("click", () => {
    clearProfile();
    navigate("/onboarding");
  });

  $$("#siteHeader [data-mega]").forEach((button) => {
    button.addEventListener("mouseenter", () => showMegaMenu(button.dataset.mega));
    button.addEventListener("focus", () => showMegaMenu(button.dataset.mega));
  });
  $("#siteHeader")?.addEventListener("mouseleave", hideMegaMenu);
  $("#megaMenu")?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-mega-action]");
    if (!action) return;
    hideMegaMenu();
    navigate(routeForMegaAction(action.dataset.megaAction));
  });

  window.addEventListener("kaso:routechange", (event) => {
    const { label, navGroup, shellVisible } = event.detail;
    $("#siteHeader").hidden = !shellVisible;
    $("#siteFooter").hidden = !shellVisible;
    $("#feedbackOpen").hidden = !shellVisible;
    setAssistantEnabled(shellVisible);
    setActiveNavigation(navGroup);
    closeOpenOverlays();

    if (shellVisible) {
      syncFinanceHeader();
      updateAssistantContext(label);
    }
  });

  return { showToast };
}
