export const NEARBY_RADIUS_METERS = 1000;
let nextQueryAt = 0;

function failure(code) { return Object.assign(new Error(code), { code }); }
function rateLimitError() {
  return Object.assign(failure("rate_limited"), { retryAfter: Math.max(1, Math.ceil((nextQueryAt - Date.now()) / 1000)) });
}
function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180;
}

export function getCurrentLocation({ geolocation = globalThis.navigator?.geolocation, secureContext = globalThis.isSecureContext } = {}) {
  if (!secureContext) return Promise.reject(failure("insecure_context"));
  if (!geolocation) return Promise.reject(failure("unsupported"));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition((result) => {
      const { latitude: lat, longitude: lon, accuracy } = result.coords;
      if (!validCoordinates(lat, lon) || !Number.isFinite(accuracy) || accuracy < 0) reject(failure("unavailable"));
      else if (accuracy > NEARBY_RADIUS_METERS) reject(failure("imprecise"));
      else resolve({ lat, lon, accuracy });
    }, (error) => reject(failure(({ 1: "permission_denied", 2: "unavailable", 3: "location_timeout" })[error.code] || "unavailable")), {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 60000,
    });
  });
}

export function locationErrorMessage(error) {
  return ({
    permission_denied: "位置權限未開啟。請在網址列的網站設定中允許位置存取，並確認裝置的定位服務已開啟，再按一次「使用目前位置」。",
    location_timeout: "定位逾時。請確認裝置的定位服務與網路已開啟，移到訊號較好的地方後再試。",
    unavailable: "目前無法取得位置。請確認裝置已開啟定位服務，或移到訊號較好的地方再試。",
    imprecise: "目前定位誤差超過 1,000 公尺，無法可靠查詢附近店家。請開啟精確位置，或移到訊號較好的地方後重新定位。",
    insecure_context: "定位需要安全連線。請使用 HTTPS 網址開啟網站後再試。",
    unsupported: "這個瀏覽器不支援定位，請使用支援定位的瀏覽器開啟網站。",
  })[error?.code] || "定位失敗，請確認瀏覽器的位置權限與裝置定位服務後再試。";
}

export function distanceMeters(from, to) {
  const radians = Math.PI / 180;
  const value = Math.sin((to.lat - from.lat) * radians / 2) ** 2
    + Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin((to.lon - from.lon) * radians / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}

const AMENITIES = {
  restaurant: ["餐廳", "food", "food"], cafe: ["咖啡店", "food", "food"],
  fast_food: ["速食店", "food", "food"], food_court: ["美食廣場", "food", "food"],
  bar: ["酒吧", "food", "food"], pub: ["餐酒館", "food", "food"],
  ice_cream: ["冰品店", "food", "food"], pharmacy: ["藥局", "services", "cart"],
};
const SHOP_TYPES = {
  convenience: ["便利商店", "shopping", "cart"], supermarket: ["超市", "shopping", "cart"],
  bakery: ["烘焙店", "food", "food"], beverages: ["飲品店", "food", "food"],
  clothes: ["服飾店", "shopping", "cart"], department_store: ["百貨公司", "shopping", "cart"],
  mall: ["商場", "shopping", "cart"], books: ["書店", "shopping", "cart"],
  electronics: ["電器店", "shopping", "cart"], hairdresser: ["髮廊", "services", "cart"],
  beauty: ["美容店", "services", "cart"], cosmetics: ["美妝店", "shopping", "cart"],
};

export function normalizeShops(payload, position) {
  if (!validCoordinates(position?.lat, position?.lon)) throw failure("invalid_coordinates");
  // HTTP 200 can contain partial elements plus a runtime-error remark.
  if (!Array.isArray(payload?.elements) || payload.remark) throw failure("invalid_response");
  const seen = new Set();
  return payload.elements.flatMap((element) => {
    if (!element || !["node", "way", "relation"].includes(element.type) || !Number.isSafeInteger(element.id)) return [];
    const tags = element.tags || {};
    const name = tags["name:zh-Hant"] || tags["name:zh"] || tags.name || tags.brand;
    const lat = element.lat ?? element.center?.lat, lon = element.lon ?? element.center?.lon;
    const isShop = tags.shop && !["no", "vacant", "closed", "disused"].includes(tags.shop);
    if ((!isShop && !AMENITIES[tags.amenity]) || typeof name !== "string" || !name.trim() || !validCoordinates(lat, lon)) return [];
    if (["yes", "true", "1"].includes(tags.disused) || ["yes", "true", "1"].includes(tags.abandoned)) return [];
    const distance = distanceMeters(position, { lat, lon }), id = `${element.type}/${element.id}`;
    if (distance > NEARBY_RADIUS_METERS || seen.has(id)) return [];
    seen.add(id);
    const address = tags["addr:full"] || [tags["addr:city"], tags["addr:district"], tags["addr:suburb"], tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
    const details = AMENITIES[tags.amenity] || SHOP_TYPES[tags.shop] || ["店家", "shopping", "cart"];
    return [{ id, name: name.trim(), lat, lon, distance,
      type: details[0], category: details[1], icon: details[2],
      address: String(address || ""), hours: typeof tags.opening_hours === "string" ? tags.opening_hours : "",
    }];
  }).sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "zh-Hant"));
}

export function sortShops(shops, sort = "distance-asc", category = "all") {
  const filtered = shops.filter((shop) => category === "all" || shop.category === category);
  const byDistance = (a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "zh-Hant");
  const sorters = {
    "distance-asc": byDistance,
    "distance-desc": (a, b) => b.distance - a.distance || a.name.localeCompare(b.name, "zh-Hant"),
    "name-asc": (a, b) => a.name.localeCompare(b.name, "zh-Hant") || byDistance(a, b),
    "type-asc": (a, b) => a.type.localeCompare(b.type, "zh-Hant") || byDistance(a, b),
    "hours-first": (a, b) => Number(Boolean(b.hours)) - Number(Boolean(a.hours)) || byDistance(a, b),
  };
  return [...filtered].sort(sorters[sort] || byDistance);
}

export async function findNearbyShops(position, { signal, fetcher = globalThis.fetch } = {}) {
  if (!validCoordinates(position?.lat, position?.lon)) throw failure("invalid_coordinates");
  if (Date.now() < nextQueryAt) throw rateLimitError();
  const { lat, lon } = position;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  let timedOut = false;
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 58000);
  try {
    if (controller.signal.aborted) throw failure("cancelled");
    const response = await fetcher("/api/nearby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat, lon }),
      credentials: "omit",
      signal: controller.signal,
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const seconds = Number(retryAfter);
      const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
      nextQueryAt = Date.now() + Math.max(30000, Number.isFinite(wait) ? wait : 30000);
      throw rateLimitError();
    }
    if (!response.ok) {
      const code = await response.json().then((data) => data?.error).catch(() => "");
      throw failure(code === "nearby_timeout" ? "query_timeout" : "query_failed");
    }
    return normalizeShops(await response.json(), position);
  } catch (error) {
    if (timedOut) throw failure("query_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
