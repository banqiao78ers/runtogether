/**
 * Next.js（Turbopack／webpack）無法正確打包 MapLibre v6 worker 的相對 import。
 * 把 worker + shared 原樣放到 public/，再以 setWorkerUrl 指向同一目錄。
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "maplibre-gl", "dist");
const out = join(root, "public", "maplibre");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(join(dist, "maplibre-gl-worker.mjs"))) {
  console.warn("[copy-maplibre-worker] maplibre-gl not installed; skip");
  process.exit(0);
}

mkdirSync(out, { recursive: true });
for (const name of files) {
  copyFileSync(join(dist, name), join(out, name));
}
console.log("[copy-maplibre-worker] synced → public/maplibre/");
