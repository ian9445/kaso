import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceMeters,
  normalizeShops,
  getCurrentLocation,
  findNearbyShops,
  sortShops,
} from "../assets/js/services/nearby.js";
import page from "../assets/js/pages/nearby.js";

const origin = { lat: 0, lon: 0 };
const point = (distance) => ({ lat: distance / 6371000 * 180 / Math.PI, lon: 0 });
const shop = (id, distance, tags = {}) => ({ type: "node", id, ...point(distance), tags: { name: `店家 ${id}`, shop: "convenience", ...tags } });
const response = (elements) => new Response(JSON.stringify({ elements }), { headers: { "content-type": "application/json" } });
const fix = { coords: { latitude: 0, longitude: 0, accuracy: 20 } };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function mockGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
}

test("distance boundary: includes 999/1000 m, excludes 1001 m, sorts and deduplicates", () => {
  const payload = { elements: [shop(2, 1000), shop(3, 1001), shop(1, 999), shop(1, 999)] };
  assert.deepEqual(normalizeShops(payload, origin).map((x) => x.id), ["node/1", "node/2"]);
  assert.ok(Math.abs(distanceMeters(origin, point(1000)) - 1000) < 0.000001);
});

test("normalization handles centers, names, unknown address, and invalid/closed records", () => {
  const elements = [
    { type: "way", id: 7, center: point(10), tags: { amenity: "cafe", name: "Cafe", "name:zh": "咖啡", opening_hours: "Mo-Fr 09:00-18:00" } },
    shop(1, 2, { shop: "vacant" }), shop(2, 2, { disused: "yes" }),
    shop(3, 2, { name: "" }), { ...shop(4, 3), lat: NaN }, null,
  ];
  const shops = normalizeShops({ elements }, origin);
  assert.equal(shops.length, 1);
  assert.equal(shops[0].name, "咖啡");
  assert.equal(shops[0].address, "");
  assert.equal(shops[0].type, "咖啡店");
  assert.equal(shops[0].category, "food");
});

test("sorting supports distance, name, type, hours, and category filters without mutation", () => {
  const shops = [
    { name: "乙店", type: "超市", category: "shopping", distance: 20, hours: "" },
    { name: "甲店", type: "咖啡店", category: "food", distance: 80, hours: "09:00-18:00" },
    { name: "丙店", type: "餐廳", category: "food", distance: 10, hours: "" },
  ];
  assert.deepEqual(sortShops(shops).map((x) => x.name), ["丙店", "乙店", "甲店"]);
  assert.deepEqual(sortShops(shops, "distance-desc").map((x) => x.name), ["甲店", "乙店", "丙店"]);
  assert.deepEqual(sortShops(shops, "name-asc").map((x) => x.name), ["乙店", "丙店", "甲店"]);
  assert.equal(sortShops(shops, "hours-first")[0].name, "甲店");
  assert.deepEqual(sortShops(shops, "type-asc", "food").map((x) => x.category), ["food", "food"]);
  assert.equal(shops[0].name, "乙店");
});

test("empty response differs from malformed or partial response", () => {
  assert.deepEqual(normalizeShops({ elements: [] }, origin), []);
  for (const payload of [{}, { elements: [], remark: "runtime error: timeout" }]) {
    assert.throws(() => normalizeShops(payload, origin), { code: "invalid_response" });
  }
});

test("geolocation handles permission, timeout, unavailable, unsupported and HTTPS", async () => {
  for (const [code, expected] of [[1, "permission_denied"], [2, "unavailable"], [3, "location_timeout"]]) {
    await assert.rejects(getCurrentLocation({ secureContext: true, geolocation: { getCurrentPosition: (_, reject) => reject({ code }) } }), { code: expected });
  }
  await assert.rejects(getCurrentLocation({ secureContext: false }), { code: "insecure_context" });
  await assert.rejects(getCurrentLocation({ secureContext: true, geolocation: null }), { code: "unsupported" });
  await assert.rejects(getCurrentLocation({ secureContext: true, geolocation: { getCurrentPosition: (ok) => ok({ coords: { ...fix.coords, accuracy: 1500 } }) } }), { code: "imprecise" });
  assert.deepEqual(await getCurrentLocation({ secureContext: true, geolocation: { getCurrentPosition: (ok) => ok(fix) } }), { ...origin, accuracy: 20 });
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

function mountHarness(t) {
  const ids = ["nearbyLocate", "nearbyRetry", "nearbyCancel", "nearbyStatus", "nearbyResults", "nearbyCount", "nearbyPosition", "nearbyMap"];
  const nodes = Object.fromEntries(ids.map((id) => [id, {
    innerHTML: "", textContent: "", disabled: false, hidden: false, listeners: {}, attrs: {},
    classList: { toggle() {} },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    removeEventListener(name) { delete this.listeners[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
  }]));
  const root = { querySelector: (selector) => nodes[selector.slice(1)] };
  mockGlobal(t, "document", { querySelector: () => root });
  mockGlobal(t, "isSecureContext", true);
  const cleanup = page.mount();
  t.after(cleanup);
  return {
    nodes,
    cleanup,
    click: (id) => nodes[id].listeners.click(),
    change: (id, value) => nodes.nearbyResults.listeners.change({ target: { id, value } }),
  };
}

test("page requests location on entry and ignores a callback after route cleanup", async (t) => {
  let success, locations = 0, queries = 0;
  mockGlobal(t, "navigator", { geolocation: { getCurrentPosition(ok) { locations++; success = ok; } } });
  t.mock.method(globalThis, "fetch", async () => { queries++; return response([]); });
  const harness = mountHarness(t);
  assert.equal(locations, 1);
  harness.cleanup();
  success(fix);
  await flush();
  assert.equal(queries, 0);
});

test("page cancels old location callbacks, shows escaped real results and no invented prices", async (t) => {
  const callbacks = [];
  mockGlobal(t, "navigator", { geolocation: { getCurrentPosition(ok) { callbacks.push(ok); } } });
  t.mock.method(globalThis, "fetch", async () => response([shop(1, 10, { name: '<img src=x onerror="alert(1)">' })]));
  const { nodes, click } = mountHarness(t);
  click("nearbyCancel");
  const current = click("nearbyLocate");
  callbacks[0](fix);
  await flush();
  assert.equal(nodes.nearbyResults.innerHTML, "");
  callbacks[1](fix);
  await current;
  assert.match(nodes.nearbyResults.innerHTML, /&lt;img/);
  assert.doesNotMatch(nodes.nearbyResults.innerHTML, /<img|免費|預估最低支出|符合預算/);
  assert.match(nodes.nearbyResults.innerHTML, /maps\/dir/);
  assert.match(nodes.nearbyMap.innerHTML, /google\.com\/maps/);
  assert.match(nodes.nearbyResults.innerHTML, /距離：近到遠/);
  assert.equal(nodes.nearbyCount.textContent, "1 間");
  assert.equal(nodes.nearbyLocate.disabled, false);
});

test("failed query offers retry using the already permitted location", async (t) => {
  let locations = 0, queries = 0;
  mockGlobal(t, "navigator", { geolocation: { getCurrentPosition(ok) { locations++; ok(fix); } } });
  t.mock.method(globalThis, "fetch", async () => {
    queries++;
    if (queries === 1) throw new TypeError("Network error");
    return response([]);
  });
  const { nodes, click } = mountHarness(t);
  await flush();
  assert.equal(nodes.nearbyRetry.hidden, false);
  assert.match(nodes.nearbyStatus.textContent, /無法取得/);
  assert.equal(nodes.nearbyResults.innerHTML, "");
  await click("nearbyRetry");
  assert.equal(locations, 1);
  assert.equal(queries, 2);
  assert.match(nodes.nearbyResults.innerHTML, /暫時找不到/);
});

test("rate limiting observes Retry-After without sending an immediate second request", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response("Busy", { status: 429, headers: { "retry-after": "30" } }); };
  await assert.rejects(findNearbyShops(origin, { fetcher }), { code: "rate_limited" });
  await assert.rejects(findNearbyShops(origin, { fetcher }), { code: "rate_limited" });
  assert.equal(calls, 1);
});
