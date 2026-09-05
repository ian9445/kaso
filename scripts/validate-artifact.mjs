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
].map(async (path) => {
  assert.equal((await stat(path)).isFile(), true, `${path} must be a regular file`);
}));

const { calculateBudgetPlan } = await import(pathToFileURL(budgetModulePath));
const plan = calculateBudgetPlan({
  currentBalance: 6800,
  income: 32001,
  fixed: 4000,
  target: 1001,
  deadline: "2028-02",
}, new Date(2026, 8, 5));
assert.equal(plan.monthlySave, 0);
assert.equal(plan.dailyAvailable, 933);

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

console.log("Artifact is valid ESM and serves the modular KASO site and admin page");
