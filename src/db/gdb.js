// Single GenosDB instance — the app's entire data, identity and P2P layer.
//
// Imported the canonical way (`from "genosdb"`): the bundler inlines GenosDB's
// core into the app bundle. The engine still loads its optional plugins (sm,
// genosrtc, …) at runtime via `new URL('./*.min.js', import.meta.url)`, so the
// build emits those .min.js next to the output bundle (see scripts/copy-genosdb.js).
import { gdb } from "genosdb";

/** Database id — also the P2P room name. Bumped to v2 to start from a clean graph
 *  (the previous room accumulated test data during development). */
export const GDB_NAME = "interpoll-vanilla-v2";

/** Feature switch — app-level GenosRTC data channels (typing, presence, roster,
 *  file transfer). PAUSED: opening several extra channels interferes with the DB's
 *  own realtime sync channel (the "syncs but not live" regression). The non-channel
 *  Phase-2 features (pagination, search, display names) are unaffected. Flip to
 *  `true` to re-enable — ideally after consolidating the four into a single channel. */
export const P2P_CHANNELS_ENABLED = false;

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

// Release the P2P room only on a REAL unload (close / reload / navigate away), exactly
// like the official GenosDB examples (graph-p2p.html). NOT `pagehide`: that also fires
// when the browser freezes a backgrounded tab, and calling leave() there drops the peer
// from the room WITHOUT reconnecting — which silently killed live sync between tabs.
addEventListener("beforeunload", () => db.room?.leave?.());
