// MapLibre v6 ships its web worker as separate ES modules; serve them from /public as .js
// (static hosts don't always send a JavaScript MIME type for .mjs).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const src = "node_modules/maplibre-gl/dist";
rmSync("public/maplibre", { recursive: true, force: true });
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker", "maplibre-gl-shared"]) {
  const code = readFileSync(`${src}/${f}.mjs`, "utf8").replaceAll("./maplibre-gl-shared.mjs", "./maplibre-gl-shared.js");
  writeFileSync(`public/maplibre/${f}.js`, code);
}
