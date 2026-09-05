import { NEARBY_OFFERS } from "../data.js";
import { getDailyBudget, getFinance } from "../services/finance.js";
import {
  escapeAttr,
  icon,
  money,
  pageTitle,
} from "../utils.js";

function nearbyMapMarkup(offers) {
  const latitudes = offers.map((offer) => offer.lat);
  const longitudes = offers.map((offer) => offer.lon);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latSpan = Math.max(0.001, maxLat - minLat);
  const lonSpan = Math.max(0.001, maxLon - minLon);

  return `
    <section class="nearby-map" aria-label="附近推薦地圖">
      <div class="nearby-map-head"><h2>附近推薦地圖</h2><small>點標記直接開啟導航</small></div>
      <div class="nearby-map-canvas">
        ${offers.map((offer, index) => {
          const left = 12 + ((offer.lon - minLon) / lonSpan) * 76;
          const top = 14 + ((maxLat - offer.lat) / latSpan) * 70;
          return `
            <a
              class="map-marker"
              style="left:${left}%;top:${top}%"
              href="https://www.google.com/maps/search/?api=1&query=${offer.lat},${offer.lon}"
              target="_blank"
              rel="noreferrer"
              title="${escapeAttr(offer.name)}"
            ><span>${index + 1}</span></a>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function render() {
  const finance = getFinance();
  const daily = getDailyBudget(finance);
  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "附近優惠",
          `帳戶有 ${money(finance.currentBalance)}，今日未用額度是 ${money(daily.unused)}。`,
          "附近優惠",
        )}
        <div class="summary-strip">
          <div><small>目前位置</small><strong>台北車站</strong></div>
          <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
          <div><small>先保留不動</small><strong>${money(finance.reserve)}</strong></div>
          <div><small>符合預算</small><strong>${NEARBY_OFFERS.length} 個</strong></div>
        </div>
        ${nearbyMapMarkup(NEARBY_OFFERS)}
        <div class="merchant-list">
          ${NEARBY_OFFERS.map((offer) => `
            <article class="merchant-card">
              <span class="merchant-icon">${icon(offer.icon)}</span>
              <div>
                <span class="platform">${offer.type} · ${offer.distance}</span>
                <h3>${offer.name}</h3>
                <p>${offer.address}</p>
                <p>${offer.note}</p>
              </div>
              <div class="merchant-result">
                <small>預估最低支出</small>
                <strong>${offer.price ? money(offer.price) : "免費"}</strong>
                <small>今日額度還剩 ${money(Math.max(0, daily.unused - offer.price))}</small>
                <a class="directions" href="https://www.google.com/maps/search/?api=1&query=${offer.lat},${offer.lon}" target="_blank" rel="noreferrer">
                  ${icon("pin")} 開啟導航
                </a>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    </main>
  `;
}

export default {
  render,
};
