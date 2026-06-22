// Single GenosDB instance — the app's entire data, identity and P2P layer.
//
// Loaded intact from the statically-served /genosdb folder (the engine resolves
// its plugins at runtime via import.meta.url, so it must not be bundled). The URL
// is built at runtime so the bundler leaves it as a dynamic import.
const { gdb } = await import(`${location.origin}/genosdb/index.js`);

/** Database id — also the P2P room name. A fresh room for the vanilla edition. */
export const GDB_NAME = "interpoll-vanilla";

// Bootstrap superadmins = the governance signers (RBAC notaries). Two are set:
// the operator's own address (Esteban — the real root of trust), and a throwaway
// DEMO identity whose mnemonic is published below (and in GenosDB's own
// examples/governance.html) so the engine can also run for any showcase visitor
// who activates it. Either key signs valid promotions; drop the demo entry (and
// DEMO_SUPERADMIN_MNEMONIC) for a fully private network.
export const SUPER_ADMINS = [
  "0xE5639DfE345F8ab845bEBE63a1C7322F9c6fF5c7", // operator (Esteban)
  "0xbfDe0eCEC5332Fd86D2570085571D6051Df098dA", // demo superadmin (public seed below)
];

/** Public demo-superadmin seed — SHOWCASE ONLY, protects nothing. Drop for real use. */
export const DEMO_SUPERADMIN_MNEMONIC =
  "panic now afford carbon donate lecture drift excite collect essay stuff prosper";

// Open, governance-driven RBAC. `guest` participates the moment it exists
// (write+link+delete, but delete is always scoped by node ACLs below — no global
// censor). `member`/`trusted` are earned tiers; `superadmin` only signs the role
// changes the public rules dictate.
export const ROLES = {
  superadmin: { can: ["assignRole"], inherits: ["trusted"] },
  trusted: { can: ["write", "link", "sync"], inherits: ["member"] },
  member: { can: ["write", "link", "sync"], inherits: ["guest"] },
  guest: { can: ["read", "sync", "write", "link", "delete"] },
};

// Public advancement rules (the "constitution"), evaluated against user:<address>
// nodes while a superadmin is online. Last-match-wins → climbing overrides the
// floor and losing a condition auto-demotes.
//
// NOTE: these thresholds are intentionally LOW so a showcase visitor sees the
// full guest → member → trusted climb within a minute. For a real network, raise
// them — and prefer earned *karma* (community up-votes, which the app already
// derives) over raw postCount, which measures volume, not trust.
export const GOVERNANCE_RULES = [
  { if: { role: "guest" }, offsetTimestamp: 5000, then: { assignRole: "member" } }, // 5s → member (demo)
  { if: { role: { $in: ["member", "trusted"] } }, then: { assignRole: "member" } }, // floor
  { if: { role: { $in: ["member", "trusted"] }, postCount: { $gte: 3 } }, then: { assignRole: "trusted" } }, // 3 posts → trusted (demo)
];

/** The ready GenosDB instance (top-level await initialises it once). */
export const db = await gdb(GDB_NAME, {
  rtc: true,
  sm: {
    superAdmins: SUPER_ADMINS,
    customRoles: ROLES,
    governanceRules: GOVERNANCE_RULES,
    acls: true,
  },
});

// Console handle for debugging (matches the GenosDB examples).
globalThis.db = db;

// Tear down the P2P connections when the page is hidden or unloaded. Without this,
// rapid reloads pile up RTCPeerConnections (the new page inits before the browser
// frees the old ones) and eventually hit Chromium's per-process cap — "Cannot
// create so many PeerConnections", which would block the app from starting.
addEventListener("pagehide", () => db.room?.leave?.());
