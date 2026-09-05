// Dev: bundle to disk (watched) + static serve.
//
// Dev mirrors the production pipeline — bundle to dist/ and serve it statically —
// so both load the engine the same way. Reload the page to pick up a rebuild.
import { spawnSync, spawn } from "node:child_process";

const build = ["build", "./index.html", "--outdir", "dist", "--public-path=/"];
spawnSync("bun", build, { stdio: "inherit" }); // initial bundle
spawn("bun", [...build, "--watch"], { stdio: "inherit" }); // rebundle on change
await import("./server.js"); // serve dist/
