// Emit GenosDB's runtime plugins next to the app bundle.
//
// `import { gdb } from "genosdb"` lets the bundler inline GenosDB's core into the
// app bundle, but the engine still loads its optional plugins (sm, genosrtc, geo,
// …) at runtime via `new URL('./*.min.js', import.meta.url)`, resolved relative to
// the output bundle. The bundler does not emit those, so copy every *.min.js to
// the output root — exactly where import.meta.url looks for them.
//
// Usage: `bun scripts/copy-genosdb.js [targetDir]`  (default: dist)
import { readdir, copyFile, mkdir } from "node:fs/promises";

const target = process.argv[2] ?? "dist";
const src = "node_modules/genosdb/dist";

await mkdir(target, { recursive: true });
const plugins = (await readdir(src)).filter((f) => f.endsWith(".min.js"));
await Promise.all(plugins.map((f) => copyFile(`${src}/${f}`, `${target}/${f}`)));

console.log(`✓ ${plugins.length} genosdb plugins → ${target}/`);
