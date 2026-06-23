// Resolve an Ethereum address to its profile display name — show names instead of
// 0x… everywhere. A live cache of `user` nodes' displayNames (which propagate P2P,
// so they reach any browser with a connected peer), read synchronously by the views.
// Dynamic resolution (not denormalised onto each post like the fork), so a renamed
// profile updates everywhere. Falls back to the abbreviated address.
import { db } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";
import { abbr } from "../state/session.js";

const names = new Map(); // address -> non-empty displayName
const listeners = new Set();
let started = false;

function cache(v) {
  if (v?.type !== TYPE.user || !v.address) return;
  const next = (v.displayName || "").trim();
  const prev = names.get(v.address);
  if (next) names.set(v.address, next);
  else names.delete(v.address);
  if (names.get(v.address) !== prev) for (const fn of listeners) fn(v.address);
}

/** Start the live display-name cache (idempotent; call once at startup). */
export async function startNames() {
  if (started) return;
  started = true;
  const { results } = await db.map({ query: { type: TYPE.user } }, ({ value }) => cache(value));
  for (const n of results) cache(n.value);
}

/** Display name for an address: the profile's displayName if set, else 0x1234…abcd. */
export function displayNameFor(address) {
  return (address && names.get(address)) || abbr(address);
}

/** Subscribe to name changes; `fn(address)` fires when a cached name changes. Returns unsub. */
export function onNameChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
