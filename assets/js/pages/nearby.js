import { getDailyBudget, getFinance } from "../services/finance.js";
import {
  DEFAULT_NEARBY_CATEGORY,
  MAP_MARKER_LIMIT,
  findNearbyShops,
  getCurrentLocation,
  getLocationHint,
  locationErrorMessage,
  mapShops,
  sortShops,
} from "../services/nearby.js";
import { createNearbyMap, loadLeaflet, TAIWAN_CENTER } from "../services/nearby-map.js";
import { escapeAttr, escapeHtml, icon, money, pageTitle } from "../utils.js";

const CATEGORY_OPTIONS = [
  ["food", "餐飲（最常用）"],
  ["essentials", "便利商店／超市"],
  ["shopping", "購物"],
  ["services", "生活服務"],
  ["all", "全部店家（較多）"],
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

function googleMapCenterUrl(position) {
  const url = new URL("https://www.google.com/maps/@");
  url.search = new URLSearchParams({
    api: "1",
    map_action: "map",
    center: `${position.lat},${position.lon}`,
    zoom: "15",
  });
  return url.href;
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
      <small>距搜尋中心的直線距離</small>
      <a class="directions" href="${escapeAttr(url.href)}" target="_blank" rel="noopener noreferrer">${icon("pin")} Google 地圖導航</a>
    </div>
  </article>`;
}

function shopsMarkup(shops, sortBy, category) {
  if (!shops.length) return `<div class="nearby-empty"><h2>這個範圍暫時找不到店家</h2>
    <p>目前的地圖資料在 1,000 公尺內沒有可顯示的店家。可以換個地圖位置再搜尋；這不代表當地一定沒有店家。</p></div>`;
  const visible = sortShops(shops, sortBy, category);
  return `<section class="nearby-results-panel" aria-labelledby="nearbyResultsTitle">
    <div class="nearby-results-head">
      <div><h2 id="nearbyResultsTitle">店家清單</h2><p id="nearbyShown" aria-live="polite">顯示 ${visible.length}／${shops.length} 間；分類與地圖同步</p></div>
      <div class="nearby-controls">
        <label>排序方式<select id="nearbySort">${selectOptions(SORT_OPTIONS, sortBy)}</select></label>
      </div>
    </div>
    <p class="nearby-price-note">店家資料沒有一致且可靠的商品價格，因此不提供可能誤導的價格排序；可先依距離、店名、類型或營業時間資料排列。</p>
    ${visible.length
      ? `<div class="merchant-list">${visible.map(shopCard).join("")}</div>`
      : `<div class="nearby-empty"><h3>這個分類目前沒有結果</h3><p>請在地圖上方切換其他分類，或選擇「全部店家」。</p></div>`}
  </section>`;
}

function render() {
  const daily = getDailyBudget(getFinance());
  return `<main class="shell main-content nearby-page"><section class="view">
    ${pageTitle("附近店家", `今日未用額度 ${money(daily.unused)}，消費前可以先看看附近有哪些選擇。`, "附近推薦")}
    <section class="nearby-location" aria-labelledby="nearbyLocationTitle">
      <div><h2 id="nearbyLocationTitle">不用找網站設定，選一種方式開始</h2>
        <p id="nearbyPrivacy">需要精準位置時才按定位並同意瀏覽器提示；不想開權限，可直接在下方地圖點位置。地圖可能先用網路位置粗略移到所在城市，KASO 不儲存位置，也不持續追蹤。</p></div>
      <div class="nearby-location-actions">
        <button id="nearbyLocate" class="primary-btn" type="button" aria-describedby="nearbyPrivacy">${icon("pin")} 使用精準目前位置</button>
        <button id="nearbyUseMap" class="secondary-btn" type="button">不開權限，直接點地圖</button>
        <button id="nearbyRetry" class="secondary-btn" type="button" hidden>重試店家搜尋</button>
        <button id="nearbyCancel" class="secondary-btn" type="button" hidden>取消</button>
      </div>
      <p id="nearbyStatus" class="nearby-status" role="status" aria-live="polite" aria-atomic="true">選擇精準定位，或直接到地圖選一個搜尋中心。</p>
    </section>
    <div class="summary-strip">
      <div><small>搜尋中心</small><strong id="nearbyPosition">尚未選擇</strong></div>
      <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
      <div><small>今日未用</small><strong>${money(daily.unused)}</strong></div>
      <div><small>附近店家</small><strong id="nearbyCount">—</strong></div>
    </div>
    <section class="nearby-map" aria-labelledby="nearbyMapTitle">
      <div class="nearby-map-head">
        <div><h2 id="nearbyMapTitle">附近店家地圖</h2><small id="nearbyMapCount">先點地圖或使用精準位置</small></div>
        <div class="nearby-map-tools">
          <label>地圖顯示<select id="nearbyMapCategory">${selectOptions(CATEGORY_OPTIONS, DEFAULT_NEARBY_CATEGORY)}</select></label>
          <button id="nearbySearchMapCenter" class="secondary-btn" type="button" disabled>搜尋地圖中央</button>
          <a id="nearbyGoogleMapLink" class="nearby-map-link" href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" hidden>在 Google 地圖開啟 ${icon("arrow")}</a>
        </div>
      </div>
      <div class="nearby-map-frame">
        <div id="nearbyMapCanvas" class="nearby-map-canvas" tabindex="0" aria-label="可拖曳的附近店家地圖；點一下地圖可搜尋該位置"></div>
        <p id="nearbyMapLoading" class="nearby-map-loading" role="status">正在載入互動地圖…</p>
      </div>
      <p id="nearbyMapHelp" class="nearby-map-help">不想開位置權限？拖曳地圖後按「搜尋地圖中央」，或直接點一下地圖。</p>
    </section>
    <div id="nearbyResults" aria-busy="false"></div>
    <p class="nearby-source">地圖與店家資料：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 貢獻者</a>；店家透過公開 Overpass 查詢，導航連至 Google Maps。地圖最多標示所選分類最近 ${MAP_MARKER_LIMIT} 間，完整結果列在下方。資料可能不完整或尚未更新，營業時間、價格與優惠請向店家確認。</p>
  </section></main>`;
}

function mount({
  mapLoader = loadLeaflet,
  mapFactory = createNearbyMap,
  hintLoader = getLocationHint,
  locateProvider = getCurrentLocation,
  shopFinder = findNearbyShops,
} = {}) {
  const root = document.querySelector(".nearby-page");
  const locate = root.querySelector("#nearbyLocate");
  const useMap = root.querySelector("#nearbyUseMap");
  const retry = root.querySelector("#nearbyRetry");
  const cancel = root.querySelector("#nearbyCancel");
  const status = root.querySelector("#nearbyStatus");
  const results = root.querySelector("#nearbyResults");
  const count = root.querySelector("#nearbyCount");
  const positionLabel = root.querySelector("#nearbyPosition");
  const mapCanvas = root.querySelector("#nearbyMapCanvas");
  const mapLoading = root.querySelector("#nearbyMapLoading");
  const mapHelp = root.querySelector("#nearbyMapHelp");
  const mapCount = root.querySelector("#nearbyMapCount");
  const mapCategory = root.querySelector("#nearbyMapCategory");
  const searchMapCenter = root.querySelector("#nearbySearchMapCenter");
  const googleMapLink = root.querySelector("#nearbyGoogleMapLink");
  let active = true;
  let generation = 0;
  let controller = null;
  let mapController = null;
  let position = null;
  let shops = [];
  let sortBy = "distance-asc";
  let category = DEFAULT_NEARBY_CATEGORY;
  let busy = false;
  let didSearch = false;

  function setBusy(value) {
    busy = value;
    locate.disabled = value;
    retry.hidden = true;
    cancel.hidden = !value;
    searchMapCenter.disabled = value || !mapController;
    mapCanvas.setAttribute("aria-busy", String(value));
    results.setAttribute("aria-busy", String(value));
    locate.innerHTML = `${icon("pin")} ${value ? "處理中…" : "使用精準目前位置"}`;
  }

  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("is-error", isError);
  }

  function updatePosition(nextPosition) {
    position = nextPosition;
    const isDevice = nextPosition.source === "device";
    positionLabel.textContent = isDevice
      ? `精準定位（誤差約 ${Math.ceil(nextPosition.accuracy).toLocaleString("zh-TW")} 公尺）`
      : "已選地圖位置";
    mapController?.setCenter(nextPosition, isDevice ? "精準位置" : "地圖選點");
    googleMapLink.href = googleMapCenterUrl(nextPosition);
    googleMapLink.hidden = false;
  }

  function paintMap() {
    const visibleCount = sortShops(shops, "distance-asc", category).length;
    const markers = mapShops(shops, category);
    mapController?.setShops(markers);
    mapCount.textContent = visibleCount > MAP_MARKER_LIMIT
      ? `地圖顯示最近 ${markers.length}／${visibleCount} 間` : `地圖顯示 ${markers.length} 間`;
  }

  function paintShops() {
    results.innerHTML = shopsMarkup(shops, sortBy, category);
  }

  function beginSearch() {
    const run = ++generation;
    controller?.abort();
    controller = new AbortController();
    setBusy(true);
    return run;
  }

  function isCurrent(run) {
    return active && run === generation;
  }

  async function queryAt(nextPosition, run) {
    updatePosition(nextPosition);
    shops = [];
    didSearch = false;
    results.innerHTML = "";
    count.textContent = "—";
    mapController?.setShops([]);
    mapCount.textContent = "正在搜尋店家…";
    message("正在搜尋周圍 1,000 公尺的店家，通常需要 10–30 秒…");
    try {
      const found = await shopFinder(nextPosition, { signal: controller.signal });
      if (!isCurrent(run)) return;
      shops = found;
      didSearch = true;
      sortBy = "distance-asc";
      count.textContent = `${shops.length} 間`;
      paintMap();
      paintShops();
      const note = nextPosition.source === "device" && nextPosition.accuracy > 100
        ? ` 定位誤差約 ${Math.ceil(nextPosition.accuracy)} 公尺，距離僅供參考。` : "";
      message((shops.length
        ? `找到 ${shops.length} 間店家。地圖預設顯示餐飲，可切換分類；清單已依距離排列。`
        : "查詢完成，目前的地圖資料在此範圍沒有店家，可換個地圖位置再找。") + note);
      setBusy(false);
    } catch (error) {
      if (!isCurrent(run)) return;
      setBusy(false);
      mapCount.textContent = "店家搜尋未完成";
      message(error.code === "rate_limited" ? `店家查詢服務目前忙碌，請等候約 ${error.retryAfter || 30} 秒再試。`
        : error.code === "query_timeout" ? "店家搜尋逾時，請稍後再試，或換個地圖位置。"
          : "目前無法取得店家資料，請檢查網路後再試。", true);
      retry.hidden = false;
    }
  }

  async function searchPrecise() {
    if (busy || !active) return;
    const run = beginSearch();
    message("請在瀏覽器提示中選擇允許。若不想開權限，取消後直接點下方地圖即可。");
    try {
      const located = await locateProvider();
      if (!isCurrent(run)) return;
      await queryAt({ ...located, source: "device" }, run);
    } catch (error) {
      if (!isCurrent(run)) return;
      setBusy(false);
      message(locationErrorMessage(error), true);
    }
  }

  async function searchSelected(nextPosition) {
    if (busy || !active) return;
    const run = beginSearch();
    await queryAt({ ...nextPosition, accuracy: 0, source: "map" }, run);
  }

  async function retryCurrent() {
    if (busy || !active || !position) return;
    const run = beginSearch();
    await queryAt(position, run);
  }

  const onLocate = () => searchPrecise();
  const onUseMap = () => {
    mapCanvas.scrollIntoView?.({ behavior: "smooth", block: "center" });
    mapCanvas.focus?.({ preventScroll: true });
    message("拖曳地圖後按「搜尋地圖中央」，或直接點一下想搜尋的位置；不需要位置權限。");
  };
  const onRetry = () => retryCurrent();
  const onCancel = () => {
    generation += 1;
    controller?.abort();
    setBusy(false);
    retry.hidden = !position;
    message("已取消搜尋。可以直接點地圖選新位置，或再使用精準定位。");
  };
  const onSearchMapCenter = () => mapController && searchSelected(mapController.getCenter());
  const onMapCategory = (event) => {
    category = event.target.value;
    if (!didSearch) return;
    paintMap();
    paintShops();
    const shown = sortShops(shops, sortBy, category).length;
    message(`已切換分類，目前共有 ${shown} 間；地圖與下方清單已同步。`);
  };
  const onResultsChange = (event) => {
    if (event.target.id !== "nearbySort") return;
    sortBy = event.target.value;
    paintShops();
    message(`清單已重新排序，目前顯示 ${sortShops(shops, sortBy, category).length} 間店家。`);
  };

  locate.addEventListener("click", onLocate);
  useMap.addEventListener("click", onUseMap);
  retry.addEventListener("click", onRetry);
  cancel.addEventListener("click", onCancel);
  searchMapCenter.addEventListener("click", onSearchMapCenter);
  mapCategory.addEventListener("change", onMapCategory);
  results.addEventListener("change", onResultsChange);

  void Promise.all([mapLoader(), hintLoader()]).then(([L, hint]) => {
    if (!active) return;
    const center = hint ? { ...hint, zoom: 12 } : TAIWAN_CENTER;
    mapController = mapFactory(L, mapCanvas, {
      center,
      onSelect: (selected) => { void searchSelected(selected); },
    });
    mapLoading.hidden = true;
    searchMapCenter.disabled = busy;
    if (position) {
      mapController.setCenter(position, position.source === "device" ? "精準位置" : "地圖選點");
      if (didSearch) paintMap();
    }
    if (hint) {
      const area = [hint.city, hint.region].filter(Boolean).join("、") || "你所在的城市附近";
      mapHelp.textContent = `地圖已粗略移到${area}。直接點想搜尋的位置，或拖曳後按「搜尋地圖中央」；不需要位置權限。`;
    }
    mapController.invalidate();
  }).catch(() => {
    if (!active) return;
    mapLoading.textContent = "互動地圖暫時無法載入；仍可使用上方的精準定位搜尋。";
    mapLoading.classList.add?.("is-error");
  });

  return () => {
    active = false;
    generation += 1;
    controller?.abort();
    mapController?.destroy();
    locate.removeEventListener("click", onLocate);
    useMap.removeEventListener("click", onUseMap);
    retry.removeEventListener("click", onRetry);
    cancel.removeEventListener("click", onCancel);
    searchMapCenter.removeEventListener("click", onSearchMapCenter);
    mapCategory.removeEventListener("change", onMapCategory);
    results.removeEventListener("change", onResultsChange);
    position = null;
    shops = [];
  };
}

export default { render, mount };
