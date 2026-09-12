import { getDailyBudget, getFinance } from "../services/finance.js";
import {
  DEFAULT_NEARBY_CATEGORIES,
  MAP_MARKER_LIMIT,
  findNearbyShops,
  getCurrentLocation,
  getLocationHint,
  locationErrorMessage,
  mapShops,
  sortShops,
} from "../services/nearby.js";
import {
  GOOGLE_PLACE_CATEGORIES,
  MAX_GOOGLE_RESULTS,
  findGoogleNearbyShops,
  getGoogleMapsConfig,
  loadGoogleMaps,
} from "../services/google-places.js";
import { createGoogleNearbyMap } from "../services/google-nearby-map.js";
import { createNearbyMap, loadLeaflet, TAIWAN_CENTER } from "../services/nearby-map.js";
import { escapeAttr, escapeHtml, icon, money, pageTitle } from "../utils.js";

const SORT_OPTIONS = [
  ["popular", "熱門優先"],
  ["distance-asc", "距離：近到遠"],
  ["distance-desc", "距離：遠到近"],
  ["name-asc", "店名：A–Z"],
  ["type-asc", "店家類型"],
];

function selectOptions(options, selected, provider) {
  return options.filter(([value]) => provider === "google" || value !== "popular").map(([value, label]) => (
    `<option value="${escapeAttr(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function categoryOptions(selected = DEFAULT_NEARBY_CATEGORIES) {
  const checked = new Set(selected);
  return GOOGLE_PLACE_CATEGORIES.map((category) => `<label class="nearby-category-option">
    <input type="checkbox" name="nearbyCategory" value="${escapeAttr(category.id)}"${checked.has(category.id) ? " checked" : ""}>
    <span>${icon(category.icon)} <b>${escapeHtml(category.label)}</b></span>
  </label>`).join("");
}

function categorySummary(selected) {
  const names = GOOGLE_PLACE_CATEGORIES.filter((category) => selected.includes(category.id)).map((category) => category.shortLabel);
  if (names.length === GOOGLE_PLACE_CATEGORIES.length) return "全部類別";
  return names.join("、") || "尚未選擇";
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

function googleDirectionsUrl(shop) {
  if (shop.googleMapsUrl) return shop.googleMapsUrl;
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    destination: `${shop.lat},${shop.lon}`,
    travelmode: "walking",
  });
  return url.href;
}

function photoAttribution(shop) {
  if (!shop.photoUrl) return "";
  const authors = (Array.isArray(shop.photoAttributions) ? shop.photoAttributions : []).map((author) => (
    author.uri
      ? `<a href="${escapeAttr(author.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(author.displayName)}</a>`
      : escapeHtml(author.displayName)
  ));
  return `<small class="merchant-photo-credit">相片：${authors.join("、") || "Google Maps 使用者"}</small>`;
}

function shopCard(shop, index) {
  const photo = shop.photoUrl
    ? `<img class="merchant-photo" src="${escapeAttr(shop.photoUrl)}" alt="${escapeAttr(shop.name)}的 Google Maps 店家照片" loading="lazy" referrerpolicy="no-referrer-when-downgrade">${photoAttribution(shop)}`
    : "";
  return `<article class="merchant-card">
    <div class="merchant-visual${photo ? " has-photo" : ""}">
      <span class="merchant-rank" aria-label="排序第 ${index + 1} 間">${String(index + 1).padStart(2, "0")}</span>
      <span class="merchant-icon">${icon(shop.icon)}</span>
      <small class="merchant-no-photo">尚無公開照片</small>
      ${photo}
    </div>
    <div class="merchant-info">
      <span class="platform">${escapeHtml(shop.type)}</span>
      <h3>${escapeHtml(shop.name)}</h3>
      <p>${escapeHtml(shop.address || "地圖資料未提供地址")}</p>
      <p>${shop.provider === "google" ? "店家與照片來自 Google Places" : "店家資料來自 OpenStreetMap"}</p>
    </div>
    <div class="merchant-result">
      <strong>約 ${Math.max(1, Math.round(shop.distance)).toLocaleString("zh-TW")} 公尺</strong>
      <small>距搜尋中心的直線距離</small>
      <a class="directions" href="${escapeAttr(googleDirectionsUrl(shop))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Google 地圖查看</a>
    </div>
  </article>`;
}

function shopsMarkup(shops, sortBy, categories, provider) {
  if (!shops.length) return `<div class="nearby-empty"><h2>這個範圍暫時找不到店家</h2>
    <p>目前的地圖資料在 1,000 公尺內沒有可顯示的店家。可以換個地圖位置或分類再搜尋；這不代表當地一定沒有店家。</p></div>`;
  const visible = sortShops(shops, sortBy, categories);
  return `<section class="nearby-results-panel" aria-labelledby="nearbyResultsTitle">
    <div class="nearby-results-head">
      <div><h2 id="nearbyResultsTitle">店家清單</h2><p id="nearbyShown" aria-live="polite">顯示 ${visible.length} 間；分類、標點與清單同步</p></div>
      <div class="nearby-controls">
        <label>排序方式<select id="nearbySort">${selectOptions(SORT_OPTIONS, sortBy, provider)}</select></label>
      </div>
    </div>
    <p class="nearby-price-note">附近店家沒有一致且可靠的商品價格，為避免誤導不提供價格排序；可依熱門度、距離、店名或類型排列。</p>
    ${visible.length
      ? `<div class="merchant-list">${visible.map(shopCard).join("")}</div>`
      : `<div class="nearby-empty"><h3>勾選的分類目前沒有結果</h3><p>請在地圖上方選其他分類，或改搜尋另一個地圖位置。</p></div>`}
  </section>`;
}

function googleSourceMarkup() {
  return `地圖、店家與照片由 <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps／Places</a> 提供；照片是否為店面、餐點或商品取決於店家現有公開資料，並顯示原作者標示。每次最多顯示 ${MAX_GOOGLE_RESULTS} 間熱門結果，資料可能不完整或尚未更新。價格與優惠請向店家確認。`;
}

function osmSourceMarkup() {
  return `目前使用 OpenStreetMap 備援：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 貢獻者</a>；店家透過公開 Overpass 查詢，導航連至 Google Maps。地圖最多標示所選分類最近 ${MAP_MARKER_LIMIT} 間。設定 Google Maps 金鑰後會自動改用 Google 地圖與公開店家照片。`;
}

function render() {
  const daily = getDailyBudget(getFinance());
  return `<main class="shell main-content nearby-page"><section class="view">
    ${pageTitle("附近店家", `今日未用額度 ${money(daily.unused)}，消費前可以先看看附近有哪些選擇。`, "附近推薦")}
    <section class="nearby-location" aria-labelledby="nearbyLocationTitle">
      <div><h2 id="nearbyLocationTitle">選一種方式開始，不必先找網站權限設定</h2>
        <p id="nearbyPrivacy">需要精準位置時才按定位並同意瀏覽器提示；不想開權限，可直接在下方地圖點位置。地圖可能先用網路位置粗略移到所在城市，KASO 不儲存位置，也不持續追蹤。</p></div>
      <div class="nearby-location-actions">
        <button id="nearbyLocate" class="primary-btn" type="button" aria-describedby="nearbyPrivacy">${icon("pin")} 使用精準目前位置</button>
        <button id="nearbyUseMap" class="secondary-btn" type="button">不開權限，直接點地圖</button>
        <button id="nearbyRetry" class="secondary-btn" type="button" hidden>重試店家搜尋</button>
        <button id="nearbyCancel" class="secondary-btn" type="button" hidden>取消</button>
      </div>
      <p id="nearbyStatus" class="nearby-status" role="status" aria-live="polite" aria-atomic="true">正在準備地圖；完成後可選精準定位或直接點地圖。</p>
    </section>
    <div class="summary-strip">
      <div><small>搜尋中心</small><strong id="nearbyPosition">尚未選擇</strong></div>
      <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
      <div><small>今日未用</small><strong>${money(daily.unused)}</strong></div>
      <div><small>目前顯示</small><strong id="nearbyCount">—</strong></div>
    </div>
    <section class="nearby-map" aria-labelledby="nearbyMapTitle">
      <div class="nearby-map-head">
        <div><h2 id="nearbyMapTitle">附近店家地圖</h2><small><span id="nearbyProvider" class="nearby-provider">正在選擇地圖服務…</span> <span id="nearbyMapCount">先點地圖或使用精準位置</span></small></div>
        <div class="nearby-map-tools">
          <details id="nearbyCategoryPicker" class="nearby-category-picker">
            <summary>店家分類：<b id="nearbyCategorySummary">${escapeHtml(categorySummary(DEFAULT_NEARBY_CATEGORIES))}</b></summary>
            <div class="nearby-category-menu">
              <p>可選一類或多類，按「套用分類」後更新。</p>
              <div id="nearbyCategoryOptions" class="nearby-category-options">${categoryOptions()}</div>
              <p id="nearbyCategoryError" class="nearby-category-error" role="status" hidden>請至少選擇一種店家分類。</p>
              <div class="nearby-category-actions">
                <button type="button" class="text-btn" data-category-action="common">常用</button>
                <button type="button" class="text-btn" data-category-action="all">全選</button>
                <button type="button" class="text-btn" data-category-action="clear">清除</button>
                <button id="nearbyApplyCategories" type="button" class="primary-btn">套用分類</button>
              </div>
            </div>
          </details>
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
    <p id="nearbySource" class="nearby-source">正在確認 Google Maps 設定…</p>
  </section></main>`;
}

function mount(dependencies = {}) {
  const fallbackMapLoader = dependencies.fallbackMapLoader || dependencies.mapLoader || loadLeaflet;
  const fallbackMapFactory = dependencies.fallbackMapFactory || dependencies.mapFactory || createNearbyMap;
  const fallbackShopFinder = dependencies.fallbackShopFinder || dependencies.shopFinder || findNearbyShops;
  const configLoader = dependencies.configLoader || getGoogleMapsConfig;
  const googleLoader = dependencies.googleLoader || loadGoogleMaps;
  const googleMapFactory = dependencies.googleMapFactory || createGoogleNearbyMap;
  const googleShopFinder = dependencies.googleShopFinder || findGoogleNearbyShops;
  const hintLoader = dependencies.hintLoader || getLocationHint;
  const locateProvider = dependencies.locateProvider || getCurrentLocation;

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
  const providerLabel = root.querySelector("#nearbyProvider");
  const searchMapCenter = root.querySelector("#nearbySearchMapCenter");
  const googleMapLink = root.querySelector("#nearbyGoogleMapLink");
  const categoryPicker = root.querySelector("#nearbyCategoryPicker");
  const categorySummaryNode = root.querySelector("#nearbyCategorySummary");
  const categoryError = root.querySelector("#nearbyCategoryError");
  const applyCategories = root.querySelector("#nearbyApplyCategories");
  const source = root.querySelector("#nearbySource");
  const categoryCheckboxes = [...root.querySelectorAll('input[name="nearbyCategory"]')];
  let active = true;
  let generation = 0;
  let controller = null;
  let mapController = null;
  let maps = null;
  let mapReady = false;
  let provider = "loading";
  let position = null;
  let shops = [];
  let sortBy = "distance-asc";
  let categories = [...DEFAULT_NEARBY_CATEGORIES];
  let busy = false;
  let didSearch = false;
  let usedFallbackData = false;

  locate.disabled = true;
  useMap.disabled = true;

  function setBusy(value) {
    busy = value;
    locate.disabled = value || !mapReady;
    useMap.disabled = value || !mapReady;
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
    const visible = sortShops(shops, "distance-asc", categories);
    const markers = mapShops(shops, categories, provider === "google" ? MAX_GOOGLE_RESULTS : MAP_MARKER_LIMIT);
    mapController?.setShops(markers);
    count.textContent = `${visible.length} 間`;
    mapCount.textContent = visible.length > markers.length
      ? `地圖顯示 ${markers.length}／${visible.length} 間` : `地圖顯示 ${markers.length} 間`;
  }

  function paintShops() {
    results.innerHTML = shopsMarkup(shops, sortBy, categories, provider);
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

  async function requestShops(nextPosition) {
    usedFallbackData = false;
    if (provider !== "google") return fallbackShopFinder(nextPosition, { signal: controller.signal });
    try {
      return await googleShopFinder(nextPosition, { maps, categories, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted || error?.code === "cancelled" || error?.code === "category_required") throw error;
      usedFallbackData = true;
      message("Google Places 暫時無法取得店家，正在改用 OpenStreetMap 備援資料…");
      return fallbackShopFinder(nextPosition, { signal: controller.signal });
    }
  }

  async function queryAt(nextPosition, run) {
    updatePosition(nextPosition);
    shops = [];
    didSearch = false;
    results.innerHTML = "";
    count.textContent = "—";
    mapController?.setShops([]);
    mapCount.textContent = "正在搜尋店家…";
    message(provider === "google"
      ? "正在向 Google Places 搜尋所選分類，通常幾秒內完成…"
      : "正在搜尋周圍 1,000 公尺的店家，通常需要 10–30 秒…");
    try {
      const found = await requestShops(nextPosition);
      if (!isCurrent(run)) return;
      shops = found;
      didSearch = true;
      sortBy = provider === "google" && !usedFallbackData ? "popular" : "distance-asc";
      paintMap();
      paintShops();
      const visibleCount = sortShops(shops, sortBy, categories).length;
      const photoCount = shops.filter((shop) => shop.photoUrl).length;
      const accuracyNote = nextPosition.source === "device" && nextPosition.accuracy > 100
        ? ` 定位誤差約 ${Math.ceil(nextPosition.accuracy)} 公尺，距離僅供參考。` : "";
      const providerNote = usedFallbackData
        ? " Google 店家資料暫時無法使用，這次結果已改用 OpenStreetMap，因此沒有 Google 店家照片。"
        : provider === "google" ? ` 其中 ${photoCount} 間有公開店家照片。` : "";
      message((visibleCount
        ? `找到 ${visibleCount} 間符合分類的店家；標點與下方清單已同步。`
        : "查詢完成，目前的資料在此範圍與分類沒有店家，可換分類或地圖位置再找。") + providerNote + accuracyNote);
      setBusy(false);
    } catch (error) {
      if (!isCurrent(run)) return;
      setBusy(false);
      mapCount.textContent = "店家搜尋未完成";
      message(error.code === "rate_limited" ? `店家查詢服務目前忙碌，請等候約 ${error.retryAfter || 30} 秒再試。`
        : error.code === "query_timeout" ? "店家搜尋逾時，請稍後再試，或換個地圖位置。"
          : error.code === "category_required" ? "請先選擇至少一種店家分類。"
            : "目前無法取得店家資料，請檢查網路後再試。", true);
      retry.hidden = false;
    }
  }

  async function searchPrecise() {
    if (busy || !active || !mapReady) return;
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
    if (busy || !active || !mapReady) return;
    const run = beginSearch();
    await queryAt({ ...nextPosition, accuracy: 0, source: "map" }, run);
  }

  async function retryCurrent() {
    if (busy || !active || !position) return;
    const run = beginSearch();
    await queryAt(position, run);
  }

  function checkedCategories() {
    return categoryCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
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
  const onCategoryAction = (event) => {
    const action = event.target.closest?.("[data-category-action]")?.dataset.categoryAction;
    if (!action) return;
    const wanted = action === "common" ? new Set(DEFAULT_NEARBY_CATEGORIES)
      : action === "all" ? new Set(GOOGLE_PLACE_CATEGORIES.map((category) => category.id)) : new Set();
    categoryCheckboxes.forEach((checkbox) => { checkbox.checked = wanted.has(checkbox.value); });
    categoryError.hidden = true;
  };
  const onApplyCategories = () => {
    const nextCategories = checkedCategories();
    if (!nextCategories.length) {
      categoryError.hidden = false;
      return;
    }
    categories = nextCategories;
    categoryError.hidden = true;
    categorySummaryNode.textContent = categorySummary(categories);
    categoryPicker.open = false;
    if (!didSearch) {
      message(`已選擇「${categorySummary(categories)}」。點地圖或使用精準位置開始搜尋。`);
      return;
    }
    if (provider === "google") {
      const run = beginSearch();
      void queryAt(position, run);
    } else {
      paintMap();
      paintShops();
      message(`已套用「${categorySummary(categories)}」，目前顯示 ${sortShops(shops, sortBy, categories).length} 間；地圖與清單已同步。`);
    }
  };
  const onResultsChange = (event) => {
    if (event.target.id !== "nearbySort") return;
    sortBy = event.target.value;
    paintShops();
    message(`清單已重新排序，目前顯示 ${sortShops(shops, sortBy, categories).length} 間店家。`);
  };
  const onImageError = (event) => {
    if (!event.target.classList?.contains("merchant-photo")) return;
    event.target.hidden = true;
    event.target.closest?.(".merchant-visual")?.classList.remove("has-photo");
  };

  locate.addEventListener("click", onLocate);
  useMap.addEventListener("click", onUseMap);
  retry.addEventListener("click", onRetry);
  cancel.addEventListener("click", onCancel);
  searchMapCenter.addEventListener("click", onSearchMapCenter);
  categoryPicker.addEventListener("click", onCategoryAction);
  applyCategories.addEventListener("click", onApplyCategories);
  results.addEventListener("change", onResultsChange);
  results.addEventListener("error", onImageError, true);

  async function initializeMap() {
    const [hint, config] = await Promise.all([hintLoader(), configLoader()]);
    if (!active) return;
    const center = hint ? { ...hint, zoom: 12 } : TAIWAN_CENTER;
    if (config) {
      try {
        maps = await googleLoader({ apiKey: config.apiKey });
        if (!active) return;
        mapController = await googleMapFactory(maps, mapCanvas, {
          center,
          mapId: config.mapId,
          onSelect: (selected) => { void searchSelected(selected); },
        });
        provider = "google";
        sortBy = "popular";
        providerLabel.textContent = "Google 地圖與店家照片";
        providerLabel.classList.add?.("is-google");
        source.innerHTML = googleSourceMarkup();
      } catch {
        maps = null;
      }
    }
    if (!mapController) {
      const L = await fallbackMapLoader();
      if (!active) return;
      mapController = await fallbackMapFactory(L, mapCanvas, {
        center,
        onSelect: (selected) => { void searchSelected(selected); },
      });
      provider = "osm";
      providerLabel.textContent = config ? "OpenStreetMap 備援（Google 暫時無法使用）" : "OpenStreetMap 備援（尚未設定 Google）";
      source.innerHTML = osmSourceMarkup();
    }
    if (!active) return;
    mapReady = true;
    mapLoading.hidden = true;
    locate.disabled = false;
    useMap.disabled = false;
    searchMapCenter.disabled = busy;
    if (position) {
      mapController.setCenter(position, position.source === "device" ? "精準位置" : "地圖選點");
      if (didSearch) paintMap();
    }
    if (hint) {
      const area = [hint.city, hint.region].filter(Boolean).join("、") || "你所在的城市附近";
      mapHelp.textContent = `地圖已粗略移到${area}。直接點想搜尋的位置，或拖曳後按「搜尋地圖中央」；不需要位置權限。`;
    }
    message(provider === "google"
      ? "Google 地圖已準備好。可使用精準位置，或不開權限直接點地圖。"
      : "備援地圖已準備好。可使用精準位置，或不開權限直接點地圖；設定 Google 金鑰後會顯示店家照片。");
    mapController.invalidate();
  }

  void initializeMap().catch(() => {
    if (!active) return;
    mapLoading.textContent = "互動地圖暫時無法載入，請檢查網路後重新進入本頁。";
    mapLoading.classList.add?.("is-error");
    message("互動地圖暫時無法載入。", true);
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
    categoryPicker.removeEventListener("click", onCategoryAction);
    applyCategories.removeEventListener("click", onApplyCategories);
    results.removeEventListener("change", onResultsChange);
    results.removeEventListener("error", onImageError, true);
    position = null;
    shops = [];
  };
}

export default { render, mount };
