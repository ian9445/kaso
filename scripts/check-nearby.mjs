import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_NEARBY_CATEGORY,
  MAP_MARKER_LIMIT,
  distanceMeters,
  normalizeShops,
  getCurrentLocation,
  getLocationHint,
  findNearbyShops,
  locationErrorMessage,
  mapShops,
  sortShops,
} from "../assets/js/services/nearby.js";
import { loadLeaflet } from "../assets/js/services/nearby-map.js";
import page from "../assets/js/pages/nearby.js";

const origin = { lat: 0, lon: 0 };
const point = (distance) => ({ lat: distance / 6371000 * 180 / Math.PI, lon: 0 });
const shop = (id, distance, tags = {}) => ({ type: "node", id, ...point(distance), tags: { name: `店家 ${id}`, shop: "convenience", ...tags } });
const response = (elements) => new Response(JSON.stringify({ elements }), { headers: { "content-type": "application/json" } });
const fix = { coords: { latitude: 0, longitude: 0, accuracy: 20 } };
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("distance boundary: includes 999/1000 m, excludes 1001 m, sorts and deduplicates", () => {
  const payload = { elements: [shop(2, 1000), shop(3, 1001), shop(1, 999), shop(1, 999)] };
  assert.deepEqual(normalizeShops(payload, origin).map((x) => x.id), ["node/1", "node/2"]);
  assert.ok(Math.abs(distanceMeters(origin, point(1000)) - 1000) < 0.000001);
});

test("normalization handles centers, names, categories, and invalid or closed records", () => {
  const elements = [
    { type: "way", id: 7, center: point(10), tags: { amenity: "cafe", name: "Cafe", "name:zh": "咖啡", opening_hours: "Mo-Fr 09:00-18:00" } },
    shop(8, 12, { shop: "supermarket", name: "超市" }),
    shop(1, 2, { shop: "vacant" }), shop(2, 2, { disused: "yes" }),
    shop(3, 2, { name: "" }), { ...shop(4, 3), lat: Number.NaN }, null,
  ];
  const shops = normalizeShops({ elements }, origin);
  assert.equal(shops.length, 2);
  assert.equal(shops[0].name, "咖啡");
  assert.equal(shops[0].type, "咖啡店");
  assert.equal(shops[0].category, "food");
  assert.equal(shops[1].category, "essentials");
});

test("sorting and map limiting support every user-facing filter without mutation", () => {
  const shops = [
    { name: "乙店", type: "超市", category: "essentials", distance: 20, hours: "" },
    { name: "甲店", type: "咖啡店", category: "food", distance: 80, hours: "09:00-18:00" },
    { name: "丙店", type: "餐廳", category: "food", distance: 10, hours: "" },
  ];
  assert.deepEqual(sortShops(shops).map((x) => x.name), ["丙店", "乙店", "甲店"]);
  assert.deepEqual(sortShops(shops, "distance-desc").map((x) => x.name), ["甲店", "乙店", "丙店"]);
  assert.deepEqual(sortShops(shops, "name-asc").map((x) => x.name), ["乙店", "丙店", "甲店"]);
  assert.equal(sortShops(shops, "hours-first")[0].name, "甲店");
  assert.deepEqual(sortShops(shops, "type-asc", "food").map((x) => x.category), ["food", "food"]);
  assert.equal(DEFAULT_NEARBY_CATEGORY, "food");
  const many = Array.from({ length: 45 }, (_, index) => ({ ...shops[1], name: `餐飲 ${index}`, distance: index }));
  assert.equal(mapShops(many).length, MAP_MARKER_LIMIT);
  assert.equal(mapShops(shops, "essentials")[0].name, "乙店");
  assert.equal(shops[0].name, "乙店");
});

test("empty response differs from malformed or partial response", () => {
  assert.deepEqual(normalizeShops({ elements: [] }, origin), []);
  for (const payload of [{}, { elements: [], remark: "runtime error: timeout" }]) {
    assert.throws(() => normalizeShops(payload, origin), { code: "invalid_response" });
  }
});

test("geolocation errors always offer the map fallback", async () => {
  for (const [code, expected] of [[1, "permission_denied"], [2, "unavailable"], [3, "location_timeout"]]) {
    await assert.rejects(getCurrentLocation({ secureContext: true, geolocation: { getCurrentPosition: (_, reject) => reject({ code }) } }), { code: expected });
  }
  await assert.rejects(getCurrentLocation({ secureContext: false }), { code: "insecure_context" });
  await assert.rejects(getCurrentLocation({ secureContext: true, geolocation: null }), { code: "unsupported" });
  await assert.rejects(getCurrentLocation({ secureContext: true, geolocation: { getCurrentPosition: (ok) => ok({ coords: { ...fix.coords, accuracy: 1500 } }) } }), { code: "imprecise" });
  assert.deepEqual(await getCurrentLocation({ secureContext: true, geolocation: { getCurrentPosition: (ok) => ok(fix) } }), { ...origin, accuracy: 20 });
  assert.match(locationErrorMessage({ code: "permission_denied" }), /直接點下方地圖/);
});

test("coarse location hint is accepted only with valid coordinates and sends no cookies", async () => {
  const hint = await getLocationHint({ fetcher: async (url, options) => {
    assert.equal(url, "/api/location-hint");
    assert.equal(options.credentials, "omit");
    return new Response(JSON.stringify({ available: true, lat: 25.03, lon: 121.56, city: "Taipei", region: "Taipei" }));
  } });
  assert.deepEqual(hint, { lat: 25.03, lon: 121.56, city: "Taipei", region: "Taipei" });
  assert.equal(await getLocationHint({ fetcher: async () => new Response(JSON.stringify({ available: false })) }), null);
  assert.equal(await getLocationHint({ fetcher: async () => { throw new TypeError("offline"); } }), null);
});

test("Leaflet loader injects local CSS and imports the bundled module", async () => {
  const appended = [];
  const documentRef = {
    querySelector: () => null,
    createElement: () => ({ dataset: {} }),
    head: { append: (node) => appended.push(node) },
  };
  const module = { map: () => null };
  const loaded = await loadLeaflet({
    documentRef,
    importer: async (url) => {
      assert.match(url, /vendor\/leaflet\/leaflet-src\.esm\.js$/);
      return module;
    },
  });
  assert.equal(loaded, module);
  assert.equal(appended.length, 1);
  assert.match(appended[0].href, /vendor\/leaflet\/leaflet\.css$/);
});

test("query uses validated coordinates and does not send cookies", async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, "/api/nearby");
    assert.equal(options.credentials, "omit");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), origin);
    return response([shop(1, 50)]);
  };
  assert.equal((await findNearbyShops(origin, { fetcher })).length, 1);
  await assert.rejects(findNearbyShops({ lat: "0);out;", lon: 0 }, { fetcher }), { code: "invalid_coordinates" });
  assert.equal(calls, 1);
});

test("query cancellation aborts the network request", async () => {
  const controller = new AbortController();
  const pending = findNearbyShops(origin, { signal: controller.signal, fetcher: (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }) });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("query timeout returns a distinct error", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = findNearbyShops(origin, { fetcher: (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }) });
  t.mock.timers.tick(58000);
  await assert.rejects(pending, { code: "query_timeout" });
});

function mountHarness(t, overrides = {}) {
  const ids = [
    "nearbyLocate", "nearbyUseMap", "nearbyRetry", "nearbyCancel", "nearbyStatus",
    "nearbyResults", "nearbyCount", "nearbyPosition", "nearbyMapCanvas", "nearbyMapLoading",
    "nearbyMapHelp", "nearbyMapCount", "nearbyMapCategory", "nearbySearchMapCenter",
    "nearbyGoogleMapLink",
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, {
    id, innerHTML: "", textContent: "", disabled: false, hidden: false, listeners: {}, attrs: {}, href: "",
    classList: { toggle() {}, add() {} },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    removeEventListener(name) { delete this.listeners[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    scrollIntoView() {}, focus() {},
  }]));
  const root = { querySelector: (selector) => nodes[selector.slice(1)] };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: { querySelector: () => root }, configurable: true });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
    else delete globalThis.document;
  });

  let onSelect;
  const mapState = { center: { lat: 23.7, lon: 121 }, markers: [], destroyed: false };
  const mapController = {
    setCenter(value) { mapState.center = { lat: value.lat, lon: value.lon }; },
    setShops(value) { mapState.markers = value; },
    getCenter() { return mapState.center; },
    invalidate() {},
    destroy() { mapState.destroyed = true; },
  };
  const dependencies = {
    mapLoader: async () => ({}),
    hintLoader: async () => null,
    mapFactory: (_, __, options) => { onSelect = options.onSelect; return mapController; },
    locateProvider: async () => ({ ...origin, accuracy: 20 }),
    shopFinder: async () => [],
    ...overrides,
  };
  const cleanup = page.mount(dependencies);
  t.after(cleanup);
  return {
    nodes,
    mapState,
    cleanup,
    selectMap: (value) => onSelect(value),
    click: (id) => nodes[id].listeners.click(),
    changeMap: (value) => nodes.nearbyMapCategory.listeners.change({ target: { value } }),
    changeSort: (value) => nodes.nearbyResults.listeners.change({ target: { id: "nearbySort", value } }),
  };
}

test("page never requests location on entry and ignores a location callback after cleanup", async (t) => {
  let resolveLocation, locations = 0, queries = 0;
  const harness = mountHarness(t, {
    locateProvider: () => { locations++; return new Promise((resolve) => { resolveLocation = resolve; }); },
    shopFinder: async () => { queries++; return []; },
  });
  await flush();
  assert.equal(locations, 0);
  assert.equal(queries, 0);
  const pending = harness.click("nearbyLocate");
  assert.equal(locations, 1);
  harness.cleanup();
  resolveLocation({ ...origin, accuracy: 20 });
  await pending;
  assert.equal(queries, 0);
});

test("manual map selection works without geolocation, escapes shops, and syncs category markers", async (t) => {
  let locations = 0, selectedPosition;
  const found = [
    { id: "node/1", name: '<img src=x onerror="alert(1)">', type: "咖啡店", category: "food", icon: "food", lat: 0.001, lon: 0, distance: 10, address: "", hours: "" },
    { id: "node/2", name: "日用超市", type: "超市", category: "essentials", icon: "cart", lat: 0.002, lon: 0, distance: 20, address: "", hours: "" },
  ];
  const harness = mountHarness(t, {
    locateProvider: async () => { locations++; return { ...origin, accuracy: 20 }; },
    shopFinder: async (position) => { selectedPosition = position; return found; },
  });
  await flush();
  harness.selectMap({ lat: 0, lon: 0 });
  await flush();
  assert.equal(locations, 0);
  assert.equal(selectedPosition.source, "map");
  assert.match(harness.nodes.nearbyResults.innerHTML, /&lt;img/);
  assert.doesNotMatch(harness.nodes.nearbyResults.innerHTML, /<img|免費|預估最低支出|符合預算/);
  assert.match(harness.nodes.nearbyResults.innerHTML, /maps\/dir/);
  assert.doesNotMatch(harness.nodes.nearbyResults.innerHTML, /日用超市/);
  assert.equal(harness.mapState.markers.length, 1);
  assert.equal(harness.nodes.nearbyCount.textContent, "2 間");
  assert.equal(harness.nodes.nearbyPosition.textContent, "已選地圖位置");
  harness.changeMap("essentials");
  assert.match(harness.nodes.nearbyResults.innerHTML, /日用超市/);
  assert.equal(harness.mapState.markers[0].category, "essentials");
  assert.match(harness.nodes.nearbyStatus.textContent, /地圖與下方清單已同步/);
});

test("precise location is requested only after clicking and failed queries can retry", async (t) => {
  let locations = 0, queries = 0;
  const harness = mountHarness(t, {
    locateProvider: async () => { locations++; return { ...origin, accuracy: 20 }; },
    shopFinder: async () => {
      queries++;
      if (queries === 1) throw new TypeError("Network error");
      return [];
    },
  });
  await flush();
  assert.equal(locations, 0);
  await harness.click("nearbyLocate");
  assert.equal(locations, 1);
  assert.equal(harness.nodes.nearbyRetry.hidden, false);
  assert.match(harness.nodes.nearbyStatus.textContent, /無法取得/);
  await harness.click("nearbyRetry");
  assert.equal(locations, 1);
  assert.equal(queries, 2);
  assert.match(harness.nodes.nearbyResults.innerHTML, /暫時找不到/);
});

test("render exposes a permission-free map route and food as the default category", () => {
  const html = page.render();
  assert.match(html, /不開權限，直接點地圖/);
  assert.match(html, /value="food" selected>餐飲（最常用）/);
  assert.match(html, /搜尋地圖中央/);
  assert.doesNotMatch(html, /<iframe/);
});

test("rate limiting observes Retry-After without sending an immediate second request", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response("Busy", { status: 429, headers: { "retry-after": "30" } }); };
  await assert.rejects(findNearbyShops(origin, { fetcher }), { code: "rate_limited" });
  await assert.rejects(findNearbyShops(origin, { fetcher }), { code: "rate_limited" });
  assert.equal(calls, 1);
});
