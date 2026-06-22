// Single GenosDB instance — the app's entire data, identity and P2P layer.
//
// Loaded intact from the statically-served /genosdb folder (the engine resolves
// its plugins at runtime via import.meta.url, so it must not be bundled). The URL
// is built at runtime so the bundler leaves it as a dynamic import.
const { gdb } = await import(`${location.origin}/genosdb/index.js`);

/** Database id — also the P2P room name. A fresh room for the vanilla edition. */
export const GDB_NAME = "interpoll-vanilla";

/** Bootstrap superadmin addresses: the governance signers (RBAC notaries). */
export const SUPER_ADMINS = ["0xE5639DfE345F8ab845bEBE63a1C7322F9c6fF5c7"];

// Open, governance-driven RBAC. `guest` participates the moment it exists
// (write+link+delete, but delete is always scoped by node ACLs below — no global
// censor). `member`/`trusted` are earned tiers; `superadmin` only signs the role
// changes the public rules dictate.
const ROLES = {
  superadmin: { can: ["assignRole"], inherits: ["trusted"] },
  trusted: { can: ["write", "link", "sync"], inherits: ["member"] },
  member: { can: ["write", "link", "sync"], inherits: ["guest"] },
  guest: { can: ["read", "sync", "write", "link", "delete"] },
};

// Public advancement rules (the "constitution"), evaluated against user:<address>
// nodes while a superadmin is online. Last-match-wins → climbing overrides the
// floor and losing a condition auto-demotes.
const GOVERNANCE_RULES = [
  { if: { role: "guest" }, offsetTimestamp: 10000, then: { assignRole: "member" } },
  { if: { role: { $in: ["member", "trusted"] } }, then: { assignRole: "member" } },
  { if: { role: { $in: ["member", "trusted"] }, postCount: { $gte: 3 } }, then: { assignRole: "trusted" } },
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
