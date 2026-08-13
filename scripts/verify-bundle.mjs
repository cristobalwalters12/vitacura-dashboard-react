import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const distDir = path.resolve("dist");
const html = await readFile(path.join(distDir, "index.html"), "utf8");
const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].map(
  ([tag]) => tag,
);

function attribute(tag, name) {
  return tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1];
}

const initialAssets = new Set();
for (const tag of tags) {
  const rel = attribute(tag, "rel");
  const reference = attribute(tag, "src") ?? attribute(tag, "href");
  if (!reference) continue;
  if (tag.startsWith("<script") || rel === "modulepreload" || rel === "stylesheet") {
    initialAssets.add(reference);
  }
}

async function compressedSize(reference) {
  const relativePath = reference.replace(/^\/?/, "");
  const buffer = await readFile(path.join(distDir, relativePath));
  return gzipSync(buffer).byteLength;
}

const initialJs = [...initialAssets].filter((asset) => asset.endsWith(".js"));
const initialCss = [...initialAssets].filter((asset) => asset.endsWith(".css"));
const jsGzip = (
  await Promise.all(initialJs.map((asset) => compressedSize(asset)))
).reduce((total, size) => total + size, 0);
const cssGzip = (
  await Promise.all(initialCss.map((asset) => compressedSize(asset)))
).reduce((total, size) => total + size, 0);

const assetFiles = await readdir(path.join(distDir, "assets"));
const sourceMaps = assetFiles.filter((file) => file.endsWith(".map"));
const lazyChunks = ["map-engine", "chart-engine", "AlertDetail"];
const failures = [];

if (jsGzip > 100 * 1024) {
  failures.push(`JS inicial: ${(jsGzip / 1024).toFixed(1)} KiB gzip (máximo 100)`);
}
if (cssGzip > 20 * 1024) {
  failures.push(`CSS inicial: ${(cssGzip / 1024).toFixed(1)} KiB gzip (máximo 20)`);
}
if (sourceMaps.length) {
  failures.push(`se generaron ${sourceMaps.length} sourcemaps de producción`);
}
for (const name of lazyChunks) {
  const asset = assetFiles.find((file) => file.startsWith(name));
  if (!asset) failures.push(`no existe el chunk diferido ${name}`);
  if (asset && [...initialAssets].some((reference) => reference.endsWith(asset))) {
    failures.push(`${name} volvió a la carga inicial`);
  }
}

if (failures.length) {
  console.error("Presupuesto de rendimiento incumplido:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const totalBytes = (
    await Promise.all(
      assetFiles.map(async (file) => (await stat(path.join(distDir, "assets", file))).size),
    )
  ).reduce((total, size) => total + size, 0);
  console.log(
    `Bundle verificado: ${(jsGzip / 1024).toFixed(1)} KiB JS inicial gzip · ${(cssGzip / 1024).toFixed(1)} KiB CSS inicial gzip · ${(totalBytes / 1024 / 1024).toFixed(2)} MiB en assets · 0 sourcemaps.`,
  );
}
