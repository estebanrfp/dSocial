// Resolve an Ethereum address to its profile display name — show names instead of
// 0x… everywhere. A live cache of `user` nodes' displayNames (which propagate P2P,
// so they reach any browser with a connected peer), read synchronously by the views.
// Dynamic resolution (not denormalised onto each post), so a renamed
// profile updates everywhere. Falls back to the abbreviated address.
import { TYPE } from "../db/schema.js";
import { select, onChange } from "../db/store.js";
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

/** Start the live display-name cache (idempotent; call once at startup). Reads from the
 *  shared store — no db.map of its own. */
export function startNames() {
  if (started) return;
  started = true;
  for (const { value } of select((v) => v.type === TYPE.user)) cache(value);
  onChange(({ value }) => cache(value), TYPE.user);
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
