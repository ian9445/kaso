// 附近優惠層 — 對應「優惠」表格。跟比價是兩個獨立入口，共用 checkBudget()。
const offerProvider = require("../providers/offerProvider");
const { checkBudget } = require("./budget");

const RADIUS_M = 1000;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const RELEVANT_TAGS = Object.keys(offerProvider.OSM_TAG_TO_CATEGORY);

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// getLocation() 由前端瀏覽器 Geolocation API 取得，這裡不需要伺服器端等價物。

// fetchNearbyStores(): 取 1,000 公尺內店家。真的打 Overpass（OpenStreetMap）即時資料；
// 失敗（離線 / API 擋）就退回一組假資料，確保 demo 不會整個掛掉。
async function fetchNearbyStores(lat, lng) {
  const tagFilter = RELEVANT_TAGS.map(
    (t) => `nwr(around:${RADIUS_M},${lat},${lng})[shop=${t}];nwr(around:${RADIUS_M},${lat},${lng})[amenity=${t}];`
  ).join("");
  const query = `[out:json][timeout:10];(${tagFilter});out center 30;`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    const json = await res.json();
    return (json.elements || [])
      .map((el) => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (elLat == null || elLng == null) return null;
        const tag = el.tags?.shop || el.tags?.amenity;
        return {
          id: `osm_${el.type}_${el.id}`,
          name: el.tags?.name || "未命名店家",
          tag,
          category: offerProvider.mapTagToCategory(tag),
          lat: elLat,
          lng: elLng,
          distance: Math.round(haversine(lat, lng, elLat, elLng)),
        };
      })
      .filter(Boolean);
  } catch (err) {
    return mockNearbyStores(lat, lng, err.message);
  }
}

function mockNearbyStores(lat, lng, reason) {
  const seed = [
    { name: "巷口早餐店", tag: "fast_food", offsetM: 120 },
    { name: "全家便利商店", tag: "convenience", offsetM: 260 },
    { name: "誠品書店", tag: "books", offsetM: 480 },
    { name: "星巴克", tag: "cafe", offsetM: 610 },
    { name: "屈臣氏", tag: "chemist", offsetM: 730 },
  ];
  return seed.map((s, i) => ({
    id: `mock_${i}`,
    name: s.name,
    tag: s.tag,
    category: offerProvider.mapTagToCategory(s.tag),
    lat: lat + s.offsetM / 111000,
    lng,
    distance: s.offsetM,
    mocked: true,
    mockReason: reason,
  }));
}

// classifyOffer(): 分成「付費優惠 / 免費活動」。資料本身就帶 type，這裡只是把它分組。
function classifyOffer(offers) {
  return {
    free: offers.filter((o) => o.type === "free"),
    paid: offers.filter((o) => o.type === "paid"),
  };
}

function sortByDistance(stores) {
  return [...stores].sort((a, b) => a.distance - b.distance);
}

// 主流程：取店家 → 依分類配對優惠 → checkBudget 依分類過濾付費優惠（免費活動永遠留著）→ 依距離排序。
async function nearbyOffers(lat, lng) {
  const stores = sortByDistance(await fetchNearbyStores(lat, lng));
  const offers = offerProvider.fetchOffers();

  const storesWithOffers = stores.map((store) => {
    const candidateOffers = offers.filter((o) => o.category === store.category);
    const { free, paid } = classifyOffer(candidateOffers);
    const affordablePaid = paid.filter((o) => checkBudget(o.value, o.category).withinBudget);
    return { ...store, offers: [...free, ...affordablePaid] };
  });

  return storesWithOffers;
}

module.exports = { fetchNearbyStores, classifyOffer, sortByDistance, nearbyOffers, haversine };
