// Dev: bundle to disk (watched) + emit plugins + static serve.
//
// Bun's HMR dev server resolves GenosDB's import.meta.url plugins to file://
// (which the browser blocks), so dev mirrors the production pipeline: bundle to
// dist/, copy the plugin .min.js next to the bundle, and serve it statically.
// Reload the page to pick up a rebuild.
import { spawnSync, spawn } from "node:child_process";

const build = ["build", "./index.html", "--outdir", "dist", "--public-path=/"];
spawnSync("bun", build, { stdio: "inherit" }); // initial bundle
spawnSync("bun", ["scripts/copy-genosdb.js", "dist"], { stdio: "inherit" });
spawn("bun", [...build, "--watch"], { stdio: "inherit" }); // rebundle on change
await import("./server.js"); // serve dist/
