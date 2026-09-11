import { getDailyBudget, getFinance } from "../services/finance.js";
import { findNearbyShops, getCurrentLocation, locationErrorMessage } from "../services/nearby.js";
import { escapeAttr, escapeHtml, icon, money, pageTitle } from "../utils.js";

function locationMap({ lat, lon }) {
  if (Math.abs(lat) > 85) return "";
  const offset = Math.min(1, 0.012 / Math.max(0.01, Math.cos(lat * Math.PI / 180)));
  const bounds = [Math.max(-180, lon - offset), Math.max(-85, lat - 0.012),
    Math.min(180, lon + offset), Math.min(85, lat + 0.012)];
  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.search = new URLSearchParams({ bbox: bounds.join(","), layer: "mapnik", marker: `${lat},${lon}` });
  return `<section class="nearby-map">
    <div class="nearby-map-head"><h2>目前位置周邊</h2><small>標記為你的位置，店家請看下方清單</small></div>
    <iframe title="目前位置周邊地圖" src="${escapeAttr(url.href)}" loading="lazy" referrerpolicy="no-referrer"></iframe>
  </section>`;
}

function shopsMarkup(shops) {
  if (!shops.length) return `<div class="nearby-empty"><h2>這個範圍暫時找不到店家</h2>
    <p>目前的地圖資料在 1,000 公尺內沒有可顯示的店家。你可以重新定位；這不代表當地一定沒有店家。</p></div>`;
  return `<h2 class="nearby-results-title">附近店家 <span>${shops.length} 間</span></h2>
    <div class="merchant-list">${shops.map((shop) => {
      const url = new URL("https://www.google.com/maps/dir/");
      url.search = new URLSearchParams({ api: "1", destination: `${shop.lat},${shop.lon}`, travelmode: "walking" });
      return `<article class="merchant-card">
        <span class="merchant-icon">${icon(shop.icon)}</span>
        <div class="merchant-info"><span class="platform">${escapeHtml(shop.type)}</span>
          <h3>${escapeHtml(shop.name)}</h3><p>${escapeHtml(shop.address || "地圖資料未提供地址")}</p>
          ${shop.hours ? `<p>登錄營業時間：${escapeHtml(shop.hours)}</p>` : ""}
        </div>
        <div class="merchant-result"><strong>約 ${Math.max(1, Math.round(shop.distance)).toLocaleString("zh-TW")} 公尺</strong>
          <small>距定位座標的直線距離</small>
          <a class="directions" href="${escapeAttr(url.href)}" target="_blank" rel="noopener noreferrer">${icon("pin")} 開啟導航</a>
        </div>
      </article>`;
    }).join("")}</div>`;
}

function render() {
  const daily = getDailyBudget(getFinance());
  return `<main class="shell main-content nearby-page"><section class="view">
    ${pageTitle("附近店家", `今日未用額度 ${money(daily.unused)}，消費前可以先看看附近有哪些選擇。`, "附近優惠")}
    <section class="nearby-location" aria-labelledby="nearbyLocationTitle">
      <div><h2 id="nearbyLocationTitle">從你的位置開始找</h2>
        <p id="nearbyPrivacy">點擊後會請求定位授權，並將座標傳至 Private.coffee 的店家查詢服務及 OpenStreetMap 地圖服務。KASO 不儲存位置，也不持續追蹤。</p></div>
      <div class="nearby-location-actions">
        <button id="nearbyLocate" class="primary-btn" type="button" aria-describedby="nearbyPrivacy">${icon("pin")} 使用目前位置</button>
        <button id="nearbyRetry" class="secondary-btn" type="button" hidden>重試店家搜尋</button>
        <button id="nearbyCancel" class="secondary-btn" type="button" hidden>取消</button>
      </div>
      <p id="nearbyStatus" class="nearby-status" role="status" aria-live="polite" aria-atomic="true">尚未定位。允許位置存取後，就能查詢周圍 1,000 公尺的店家。</p>
    </section>
    <div class="summary-strip">
      <div><small>目前位置</small><strong id="nearbyPosition">尚未定位</strong></div>
      <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
      <div><small>今日未用</small><strong>${money(daily.unused)}</strong></div>
      <div><small>附近店家</small><strong id="nearbyCount">—</strong></div>
    </div>
    <div id="nearbyMap"></div><div id="nearbyResults" aria-busy="false"></div>
    <p class="nearby-source">店家資料：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 貢獻者</a>，由 <a href="https://private.coffee/" target="_blank" rel="noopener noreferrer">Private.coffee</a> 提供查詢。資料可能不完整或尚未更新；營業時間、價格與優惠請向店家確認。</p>
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
  let active = true, generation = 0, controller = null, position = null, busy = false;

  function setBusy(value) {
    busy = value;
    locate.disabled = value;
    retry.hidden = true;
    cancel.hidden = !value;
    results.setAttribute("aria-busy", String(value));
    locate.innerHTML = `${icon("pin")} ${value ? "處理中…" : position ? "重新定位" : "使用目前位置"}`;
  }
  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("is-error", isError);
  }
  async function search(usePreviousPosition = false) {
    if (busy || !active) return;
    const run = ++generation;
    const isCurrent = () => active && run === generation;
    controller = new AbortController();
    setBusy(true);
    results.innerHTML = "";
    count.textContent = "—";
    if (!usePreviousPosition) {
      position = null;
      map.innerHTML = "";
      label.textContent = "定位中…";
      message("正在取得位置，請在瀏覽器提示中選擇允許。若沒有提示，請檢查網址列的位置權限。");
    }
    try {
      if (!usePreviousPosition) {
        const located = await getCurrentLocation();
        if (!isCurrent()) return;
        position = located;
        label.textContent = `已定位（誤差約 ${Math.ceil(position.accuracy).toLocaleString("zh-TW")} 公尺）`;
        map.innerHTML = locationMap(position);
      }
      message("已取得位置，正在搜尋周圍 1,000 公尺的店家…");
      const shops = await findNearbyShops(position, { signal: controller.signal });
      if (!isCurrent()) return;
      count.textContent = `${shops.length} 間`;
      results.innerHTML = shopsMarkup(shops);
      const note = position.accuracy > 100 ? ` 定位誤差約 ${Math.ceil(position.accuracy)} 公尺，距離僅供參考；可移到訊號較好的地方重新定位。` : "";
      message((shops.length ? `找到 ${shops.length} 間店家，已依直線距離由近到遠排列。` : "查詢完成，目前的地圖資料在此範圍沒有店家。") + note);
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
  locate.addEventListener("click", onLocate);
  retry.addEventListener("click", onRetry);
  cancel.addEventListener("click", onCancel);
  return () => {
    active = false;
    generation += 1;
    controller?.abort();
    locate.removeEventListener("click", onLocate);
    retry.removeEventListener("click", onRetry);
    cancel.removeEventListener("click", onCancel);
    position = null;
  };
}

export default { render, mount };
