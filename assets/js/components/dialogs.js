import {
  clearAccount,
  getAccount,
  saveAccount,
  saveFeedback,
} from "../store.js";
import { $, $$, icon } from "../utils.js";

let toastTimer = null;

export function dialogsMarkup() {
  return `
    <button id="feedbackOpen" class="feedback-btn" type="button">回報問題</button>

    <dialog id="feedbackDialog">
      <form class="dialog-body" id="feedbackForm">
        <div class="dialog-head">
          <div><p class="eyebrow">使用者回饋</p><h2>告訴我們哪裡需要調整</h2></div>
          <button id="feedbackClose" class="dialog-close" type="button" aria-label="關閉">${icon("x")}</button>
        </div>
        <label class="field">
          回報類型
          <select id="feedbackType">
            <option>功能故障</option>
            <option>資料錯誤</option>
            <option>功能建議</option>
          </select>
        </label>
        <textarea id="feedbackText" placeholder="請描述你遇到的狀況…"></textarea>
        <div class="dialog-actions">
          <button id="feedbackCancel" class="secondary-btn" type="button">取消</button>
          <button class="primary-btn" type="submit">送出回報</button>
        </div>
      </form>
    </dialog>

    <dialog id="profileDialog" class="profile-dialog">
      <div class="dialog-body">
        <div class="dialog-head">
          <div><p class="eyebrow">KASO 帳號</p><h2>個人資料與登入</h2></div>
          <button id="profileClose" class="dialog-close" type="button" aria-label="關閉">${icon("x")}</button>
        </div>
        <div id="profileSignedOut">
          <div class="profile-provider-grid">
            <button type="button" data-provider="Google"><span class="provider-mark">G</span>Google</button>
            <button type="button" data-provider="Apple"><span class="provider-mark"></span>Apple</button>
          </div>
          <div class="account-divider">或使用一般帳號</div>
          <form id="accountLoginForm" class="account-login-form">
            <input id="accountName" autocomplete="name" placeholder="姓名">
            <input id="accountEmail" type="email" autocomplete="email" placeholder="電子郵件" required>
            <input id="accountPassword" type="password" autocomplete="current-password" placeholder="密碼" minlength="4" required>
            <button type="submit">登入</button>
          </form>
          <p class="account-note">一般帳號目前會保存在這台裝置；Google 與 Apple 按鈕已預留，正式 OAuth 需設定應用程式金鑰。</p>
        </div>
        <div id="profileSignedIn" hidden>
          <div class="account-card">
            <span class="account-avatar">${icon("user")}</span>
            <span><small>已登入</small><strong id="signedInName">KASO 使用者</strong><small id="signedInEmail"></small></span>
          </div>
          <div class="dialog-actions">
            <button id="profileReset" class="secondary-btn" type="button">重新設定預算</button>
            <button id="accountLogout" class="primary-btn" type="button">登出</button>
          </div>
        </div>
      </div>
    </dialog>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>
  `;
}

export function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2300);
}

export function syncAccountDialog() {
  const account = getAccount();
  const signedOut = $("#profileSignedOut");
  const signedIn = $("#profileSignedIn");
  if (!signedOut || !signedIn) return;

  signedOut.hidden = Boolean(account);
  signedIn.hidden = !account;
  if (account) {
    $("#signedInName").textContent = account.name || "KASO 使用者";
    $("#signedInEmail").textContent = account.email || "";
  }
}

export function mountDialogs({ onResetProfile }) {
  const profileDialog = $("#profileDialog");
  const feedbackDialog = $("#feedbackDialog");

  $("#profileOpen")?.addEventListener("click", () => {
    syncAccountDialog();
    profileDialog.showModal();
  });
  $("#profileClose")?.addEventListener("click", () => profileDialog.close());
  $("#profileReset")?.addEventListener("click", () => {
    profileDialog.close();
    onResetProfile();
  });
  $("#accountLogout")?.addEventListener("click", () => {
    clearAccount();
    syncAccountDialog();
    showToast("已登出");
  });

  $$("#profileDialog [data-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast(`${button.dataset.provider} 登入介面已完成，正式啟用需設定 OAuth 金鑰`);
    });
  });

  $("#accountLoginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#accountEmail").value.trim();
    const password = $("#accountPassword").value;
    if (!email || password.length < 4) {
      showToast("請填入有效帳號與至少 4 碼密碼");
      return;
    }

    const name = $("#accountName").value.trim() || email.split("@")[0];
    saveAccount({ name, email });
    $("#accountPassword").value = "";
    syncAccountDialog();
    showToast("已登入 KASO 一般帳號");
  });

  $("#feedbackOpen")?.addEventListener("click", () => feedbackDialog.showModal());
  $("#feedbackClose")?.addEventListener("click", () => feedbackDialog.close());
  $("#feedbackCancel")?.addEventListener("click", () => feedbackDialog.close());
  $("#feedbackForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("#feedbackText").value.trim();
    if (!text) {
      showToast("請先填寫回報內容");
      return;
    }

    saveFeedback({
      type: $("#feedbackType").value,
      text,
      route: window.location.hash,
      at: new Date().toISOString(),
    });
    feedbackDialog.close();
    $("#feedbackText").value = "";
    showToast("回報已保存在此裝置中");
  });
}
