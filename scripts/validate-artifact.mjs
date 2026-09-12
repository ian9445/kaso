import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");
const stylesheetPath = resolve(projectRoot, "dist/client/assets/css/styles.css");
const appModulePath = resolve(projectRoot, "dist/client/assets/js/main.js");
const financeModulePath = resolve(projectRoot, "dist/client/assets/js/services/finance.js");
const budgetModulePath = resolve(projectRoot, "dist/client/assets/js/services/budget.js");
const nearbyMapModulePath = resolve(projectRoot, "dist/client/assets/js/services/nearby-map.js");
const googlePlacesModulePath = resolve(projectRoot, "dist/client/assets/js/services/google-places.js");
const googleNearbyMapModulePath = resolve(projectRoot, "dist/client/assets/js/services/google-nearby-map.js");
const leafletModulePath = resolve(projectRoot, "dist/client/assets/vendor/leaflet/leaflet-src.esm.js");
const leafletStylesheetPath = resolve(projectRoot, "dist/client/assets/vendor/leaflet/leaflet.css");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
JSON.parse(manifest);
await Promise.all([
  stylesheetPath,
  appModulePath,
  financeModulePath,
  budgetModulePath,
  nearbyMapModulePath,
  googlePlacesModulePath,
  googleNearbyMapModulePath,
  leafletModulePath,
  leafletStylesheetPath,
].map(async (path) => {
  assert.equal((await stat(path)).isFile(), true, `${path} must be a regular file`);
}));

const {
  calculateBudgetPlan,
  DAILY_BUDGET_ADVICE_THRESHOLD,
} = await import(pathToFileURL(budgetModulePath));
const plan = calculateBudgetPlan({
  currentBalance: 6800,
  income: 32001,
  fixed: 4000,
  target: 1001,
  deadline: "2028-02",
}, new Date(2026, 8, 5));
assert.equal(plan.monthlySave, 0);
assert.equal(plan.dailyAvailable, 933);
assert.equal(DAILY_BUDGET_ADVICE_THRESHOLD, 200);

// A data URL forces ESM parsing even though the generated output has no package.json.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);

const app = workerModule.default;
const indexResponse = await app.fetch(new Request("https://kaso.test/"), {}, { waitUntil() {} });
const adminResponse = await app.fetch(new Request("https://kaso.test/admin"), {}, { waitUntil() {} });
assert.equal(indexResponse.status, 200);
assert.equal(adminResponse.status, 200);
const indexBody = await indexResponse.text();
assert.match(indexBody, /卡搜/);
assert.match(indexBody, /type="module" src="\.\/assets\/js\/main\.js"/);
assert.match(await adminResponse.text(), /管理後台/);
assert.doesNotMatch(source, /__KASO_(?:INDEX|ADMIN)_HTML__/);

const unavailableHint = await app.fetch(new Request("https://kaso.test/api/location-hint"), {}, { waitUntil() {} });
assert.deepEqual(await unavailableHint.json(), { available: false });
const hintRequest = new Request("https://kaso.test/api/location-hint");
Object.defineProperty(hintRequest, "cf", { value: {
  latitude: "25.0331",
  longitude: "121.5654",
  city: "Taipei",
  region: "Taipei City",
} });
const availableHint = await app.fetch(hintRequest, {}, { waitUntil() {} });
assert.deepEqual(await availableHint.json(), {
  available: true,
  lat: 25.03,
  lon: 121.57,
  city: "Taipei",
  region: "Taipei City",
});

const unavailableMaps = await app.fetch(new Request("https://kaso.test/api/maps-config"), {}, { waitUntil() {} });
assert.deepEqual(await unavailableMaps.json(), { available: false });
const availableMaps = await app.fetch(new Request("https://kaso.test/api/maps-config"), {
  GOOGLE_MAPS_BROWSER_KEY: "browser-key-for-test",
  GOOGLE_MAPS_MAP_ID: "kaso-map",
}, { waitUntil() {} });
assert.deepEqual(await availableMaps.json(), {
  available: true,
  apiKey: "browser-key-for-test",
  mapId: "kaso-map",
});

const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
try {
  globalThis.fetch = async (url, options) => {
    upstreamCalls += 1;
    assert.equal(url, "https://maps.mail.ru/osm/tools/overpass/api/interpreter");
    assert.equal(options.method, "POST");
    assert.match(options.headers["user-agent"], /KASO-Nearby/);
    assert.match(String(options.body), /around%3A1000%2C25\.0478%2C121\.517/);
    return new Response(JSON.stringify({ elements: [] }), {
      headers: { "content-type": "application/json" },
    });
  };
  const nearbyRequest = new Request("https://kaso.test/api/nearby", {
    method: "POST",
    headers: { origin: "https://kaso.test", "content-type": "application/json" },
    body: JSON.stringify({ lat: 25.0478, lon: 121.517 }),
  });
  const nearbyResponse = await app.fetch(nearbyRequest, {}, { waitUntil() {} });
  assert.equal(nearbyResponse.status, 200);
  assert.deepEqual((await nearbyResponse.json()).elements, []);
  assert.equal(upstreamCalls, 1);

  const invalidNearby = await app.fetch(new Request("https://kaso.test/api/nearby", {
    method: "POST",
    headers: { origin: "https://kaso.test", "content-type": "application/json" },
    body: JSON.stringify({ lat: "not-a-coordinate", lon: 121.517 }),
  }), {}, { waitUntil() {} });
  assert.equal(invalidNearby.status, 400);
  assert.equal(upstreamCalls, 1);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Artifact is valid ESM and serves KASO, admin, Google Maps config, coarse hints, and the nearby-shop proxy");
