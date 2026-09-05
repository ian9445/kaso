import { pageTitle } from "../utils.js";

function render() {
  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "找不到這個頁面",
          "網址可能已失效，請回到首頁繼續使用 KASO。",
          "404",
        )}
        <div class="feature-card route-error">
          <p>這個功能頁不存在，或網址輸入有誤。</p>
          <button class="primary-btn" type="button" data-route="/home">回到首頁</button>
        </div>
      </section>
    </main>
  `;
}

export default {
  render,
};
