// Single GenosDB instance for the whole app.
//
// Loaded intact from the statically-served /genosdb folder (see
// scripts/copy-genosdb.js). The URL is built at runtime so the bundler leaves it
// as a dynamic import instead of trying to inline the engine.
const GDB_URL = `${location.origin}/genosdb/index.js`;
const { gdb } = await import(GDB_URL);

export const GDB_NAME = "interpoll-vanilla";

/** The app's GenosDB graph: signed nodes, P2P sync over WebRTC, OPFS storage. */
export const db = await gdb(GDB_NAME, { rtc: true });

// Console handle for debugging.
globalThis.db = db;
