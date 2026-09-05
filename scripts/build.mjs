import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const workerSource = await readFile(resolve(projectRoot, "worker/index.js"), "utf8");
const [indexHtml, adminHtml] = await Promise.all([
  readFile(resolve(projectRoot, "index.html"), "utf8"),
  readFile(resolve(projectRoot, "admin.html"), "utf8"),
]);

const output = workerSource
  .replace("__KASO_INDEX_HTML__", () => JSON.stringify(indexHtml))
  .replace("__KASO_ADMIN_HTML__", () => JSON.stringify(adminHtml));

if (output.includes("__KASO_INDEX_HTML__") || output.includes("__KASO_ADMIN_HTML__")) {
  throw new Error("HTML build placeholders were not replaced");
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, "client"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
await writeFile(resolve(distRoot, "server/index.js"), output);
await cp(resolve(projectRoot, "assets"), resolve(distRoot, "client/assets"), { recursive: true });
await cp(resolve(projectRoot, ".openai/hosting.json"), resolve(distRoot, ".openai/hosting.json"));

try {
  await access(resolve(projectRoot, "drizzle"));
  await cp(resolve(projectRoot, "drizzle"), resolve(distRoot, ".openai/drizzle"), { recursive: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(`Built ${distRoot}`);
