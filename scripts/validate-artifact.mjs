import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
JSON.parse(manifest);

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
assert.match(await indexResponse.text(), /卡搜/);
assert.match(await adminResponse.text(), /管理後台/);

console.log("Artifact is valid ESM and serves both KASO pages");
