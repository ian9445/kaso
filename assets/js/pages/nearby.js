import { getDailyBudget, getFinance } from "../services/finance.js";
import {
  findNearbyShops,
  getCurrentLocation,
  locationErrorMessage,
  sortShops,
} from "../services/nearby.js";
import { escapeAttr, escapeHtml, icon, money, pageTitle } from "../utils.js";

function locationMap({ lat, lon }) {
  const mapUrl = new URL("https://www.google.com/maps");
  mapUrl.search = new URLSearchParams({ q: `${lat},${lon}`, z: "15", output: "embed" });
  const openUrl = new URL("https://www.google.com/maps/@");
  openUrl.search = new URLSearchParams({
    api: "1",
    map_action: "map",
    center: `${lat},${lon}`,
    zoom: "15",
  });
  return `<section class="nearby-map">
    <div class="nearby-map-head">
      <div><h2>Google 地圖</h2><small>中心標記為你這次允許使用的位置</small></div>
      <a class="nearby-map-link" href="${escapeAttr(openUrl.href)}" target="_blank" rel="noopener noreferrer">在 Google 地圖開啟 ${icon("arrow")}</a>
    </div>
    <iframe title="目前位置周邊的 Google 地圖" src="${escapeAttr(mapUrl.href)}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </section>`;
}

const CATEGORY_OPTIONS = [
  ["all", "全部店家"],
  ["food", "餐飲"],
  ["shopping", "購物"],
  ["services", "生活服務"],
];

const SORT_OPTIONS = [
  ["distance-asc", "距離：近到遠"],
  ["distance-desc", "距離：遠到近"],
  ["name-asc", "店名：A–Z"],
  ["type-asc", "店家類型"],
  ["hours-first", "有營業時間資料優先"],
];

function selectOptions(options, selected) {
  return options.map(([value, label]) => (
    `<option value="${escapeAttr(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function shopCard(shop, index) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    destination: `${shop.lat},${shop.lon}`,
    travelmode: "walking",
  });
  return `<article class="merchant-card">
    <div class="merchant-visual">
      <span class="merchant-rank" aria-label="排序第 ${index + 1} 間">${String(index + 1).padStart(2, "0")}</span>
      <span class="merchant-icon">${icon(shop.icon)}</span>
    </div>
    <div class="merchant-info">
      <span class="platform">${escapeHtml(shop.type)}</span>
      <h3>${escapeHtml(shop.name)}</h3>
      <p>${escapeHtml(shop.address || "地圖資料未提供地址")}</p>
      <p>${shop.hours ? `營業時間資料：${escapeHtml(shop.hours)}` : "尚無營業時間資料"}</p>
    </div>
    <div class="merchant-result">
      <strong>約 ${Math.max(1, Math.round(shop.distance)).toLocaleString("zh-TW")} 公尺</strong>
      <small>距定位座標的直線距離</small>
      <a class="directions" href="${escapeAttr(url.href)}" target="_blank" rel="noopener noreferrer">${icon("pin")} Google 地圖導航</a>
    </div>
  </article>`;
}

function shopsMarkup(shops, sortBy, category) {
  if (!shops.length) return `<div class="nearby-empty"><h2>這個範圍暫時找不到店家</h2>
    <p>目前的地圖資料在 1,000 公尺內沒有可顯示的店家。你可以重新定位；這不代表當地一定沒有店家。</p></div>`;
  const visible = sortShops(shops, sortBy, category);
  return `<section class="nearby-results-panel" aria-labelledby="nearbyResultsTitle">
    <div class="nearby-results-head">
      <div><h2 id="nearbyResultsTitle">附近店家</h2><p id="nearbyShown" aria-live="polite">顯示 ${visible.length}／${shops.length} 間</p></div>
      <div class="nearby-controls">
        <label>店家分類<select id="nearbyCategory">${selectOptions(CATEGORY_OPTIONS, category)}</select></label>
        <label>排序方式<select id="nearbySort">${selectOptions(SORT_OPTIONS, sortBy)}</select></label>
      </div>
    </div>
    <p class="nearby-price-note">店家資料沒有一致且可靠的商品價格，因此不提供可能誤導的價格排序；點進店家後再確認實際價格與優惠。</p>
    ${visible.length
      ? `<div class="merchant-list">${visible.map(shopCard).join("")}</div>`
      : `<div class="nearby-empty"><h3>這個分類目前沒有結果</h3><p>請切換成「全部店家」或其他分類。</p></div>`}
  </section>`;
}

function render() {
  const daily = getDailyBudget(getFinance());
  return `<main class="shell main-content nearby-page"><section class="view">
    ${pageTitle("附近店家", `今日未用額度 ${money(daily.unused)}，消費前可以先看看附近有哪些選擇。`, "附近推薦")}
    <section class="nearby-location" aria-labelledby="nearbyLocationTitle">
      <div><h2 id="nearbyLocationTitle">允許位置後，自動找附近店家</h2>
        <p id="nearbyPrivacy">進入本頁會請求一次定位授權。允許後，座標會用於查詢 OpenStreetMap 店家資料並載入 Google 地圖；KASO 不儲存位置，也不持續追蹤。</p></div>
      <div class="nearby-location-actions">
        <button id="nearbyLocate" class="primary-btn" type="button" aria-describedby="nearbyPrivacy">${icon("pin")} 開啟位置並搜尋</button>
        <button id="nearbyRetry" class="secondary-btn" type="button" hidden>重試店家搜尋</button>
        <button id="nearbyCancel" class="secondary-btn" type="button" hidden>取消</button>
      </div>
      <p id="nearbyStatus" class="nearby-status" role="status" aria-live="polite" aria-atomic="true">正在準備定位授權提示…</p>
    </section>
    <div class="summary-strip">
      <div><small>目前位置</small><strong id="nearbyPosition">尚未定位</strong></div>
      <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
      <div><small>今日未用</small><strong>${money(daily.unused)}</strong></div>
      <div><small>附近店家</small><strong id="nearbyCount">—</strong></div>
    </div>
    <div id="nearbyMap"></div><div id="nearbyResults" aria-busy="false"></div>
    <p class="nearby-source">店家資料：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 貢獻者</a>，透過公開 Overpass 查詢節點取得；地圖由 Google Maps 顯示。資料可能不完整或尚未更新，營業時間、價格與優惠請向店家確認。</p>
  </section></main>`;
}

function mount() {
  const root = document.querySelector(".nearby-page");
  const locate = root.querySelector("#nearbyLocate");
  const retry = root.querySelector("#nearbyRetry");
  const cancel = root.querySelector("#nearbyCancel");
  const status = root.querySelector("#nearbyStatus");
  const results = root.querySelector("#nearbyResults");
  const count = root.querySelector("#nearbyCount");
  const label = root.querySelector("#nearbyPosition");
  const map = root.querySelector("#nearbyMap");
  let active = true;
  let generation = 0;
  let controller = null;
  let position = null;
  let shops = [];
  let sortBy = "distance-asc";
  let category = "all";
  let busy = false;

  function setBusy(value) {
    busy = value;
    locate.disabled = value;
    retry.hidden = true;
    cancel.hidden = !value;
    results.setAttribute("aria-busy", String(value));
    locate.innerHTML = `${icon("pin")} ${value ? "處理中…" : position ? "重新定位" : "開啟位置並搜尋"}`;
  }

  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("is-error", isError);
  }

  function paintShops() {
    results.innerHTML = shopsMarkup(shops, sortBy, category);
  }

  async function search(usePreviousPosition = false) {
    if (busy || !active) return;
    const run = ++generation;
    const isCurrent = () => active && run === generation;
    controller = new AbortController();
    setBusy(true);
    shops = [];
    results.innerHTML = "";
    count.textContent = "—";
    if (!usePreviousPosition) {
      position = null;
      map.innerHTML = "";
      label.textContent = "定位中…";
      message("請在瀏覽器提示中選擇允許位置。若沒有提示，請檢查網址列旁的位置權限。");
    }
    try {
      if (!usePreviousPosition) {
        const located = await getCurrentLocation();
        if (!isCurrent()) return;
        position = located;
        label.textContent = `已定位（誤差約 ${Math.ceil(position.accuracy).toLocaleString("zh-TW")} 公尺）`;
        map.innerHTML = locationMap(position);
      }
      message("已取得位置，正在搜尋周圍 1,000 公尺的店家，通常需要 10–30 秒…");
      const found = await findNearbyShops(position, { signal: controller.signal });
      if (!isCurrent()) return;
      shops = found;
      sortBy = "distance-asc";
      category = "all";
      count.textContent = `${shops.length} 間`;
      paintShops();
      const note = position.accuracy > 100 ? ` 定位誤差約 ${Math.ceil(position.accuracy)} 公尺，距離僅供參考；可移到訊號較好的地方重新定位。` : "";
      message((shops.length ? `找到 ${shops.length} 間店家，已依距離由近到遠排列。` : "查詢完成，目前的地圖資料在此範圍沒有店家。") + note);
      setBusy(false);
    } catch (error) {
      if (!isCurrent()) return;
      setBusy(false);
      if (position) {
        message(error.code === "rate_limited" ? `店家查詢服務目前忙碌，請等候約 ${error.retryAfter || 30} 秒再試。`
          : error.code === "query_timeout" ? "店家搜尋逾時，請稍後再試。"
            : "目前無法取得店家資料，請檢查網路後再試。", true);
        retry.hidden = false;
      } else {
        label.textContent = "尚未定位";
        message(locationErrorMessage(error), true);
      }
    }
  }

  const onLocate = () => search();
  const onRetry = () => search(true);
  const onCancel = () => {
    generation += 1;
    controller?.abort();
    setBusy(false);
    if (!position) label.textContent = "尚未定位";
    retry.hidden = !position;
    message("已取消搜尋。準備好時可以再試一次。");
  };
  const onResultsChange = (event) => {
    if (event.target.id === "nearbySort") sortBy = event.target.value;
    else if (event.target.id === "nearbyCategory") category = event.target.value;
    else return;
    paintShops();
    const shown = sortShops(shops, sortBy, category).length;
    message(`目前顯示 ${shown} 間店家，可繼續切換分類或排序。`);
  };

  locate.addEventListener("click", onLocate);
  retry.addEventListener("click", onRetry);
  cancel.addEventListener("click", onCancel);
  results.addEventListener("change", onResultsChange);
  void search();

  return () => {
    active = false;
    generation += 1;
    controller?.abort();
    locate.removeEventListener("click", onLocate);
    retry.removeEventListener("click", onRetry);
    cancel.removeEventListener("click", onCancel);
    results.removeEventListener("change", onResultsChange);
    position = null;
    shops = [];
  };
}

export default { render, mount };
