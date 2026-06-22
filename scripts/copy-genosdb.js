// Copy GenosDB's intact dist into a statically-served folder.
//
// GenosDB must NOT be bundled: the engine loads its plugins (sm, genosrtc, …)
// at runtime via `new URL('./*.min.js', import.meta.url)`, so bundlers split or
// drop the sibling modules. Serving the folder verbatim keeps them resolvable.
//
// Usage: `bun scripts/copy-genosdb.js [targetDir]`  (default: public)
import { cp, mkdir, rm } from "node:fs/promises";

const target = process.argv[2] ?? "public";
const dest = `${target}/genosdb`;

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp("node_modules/genosdb/dist", dest, { recursive: true });

console.log(`✓ genosdb dist → ${dest}`);
