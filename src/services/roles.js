// Governance / RBAC standing. The Security Manager creates each identity's
// `user:<address>` node on login (role `guest`, or `superadmin` if configured) and the
// governance engine — running only while a superadmin is online — rewrites `role` per the
// public rules in db/gdb.js. The app writes *metrics* (postCount) into that same node so
// the member→trusted rule can read them. db.put REPLACES the node, so every metric write
// spreads the existing value to preserve `role`. Reads come from the in-memory store.
import { db } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";
import { select, value as nodeOf, onChange } from "../db/store.js";
import { activeAddress } from "./identity.js";

const userNodeId = (addr) => `user:${addr}`;

/**
 * Read the governance node, retrying briefly. On a reload the node may not have synced
 * into the store yet; without this wait a not-yet-loaded node looks brand-new and we'd
 * overwrite a real role with `guest`.
 */
async function loadUserNode(id, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const v = nodeOf(id);
    if (v) return v;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

/**
 * Ensure the active identity's governance node exists. Runs on every login/reload, so it
 * must NEVER overwrite `role`: the SM/governance owns it. Only a genuinely new identity
 * (still absent after the sync wait) gets the one-time welcome write.
 */
export async function ensureUserDoc(address = activeAddress()) {
  if (!address) return null;
  const id = userNodeId(address);
  const v = await loadUserNode(id);
  if (v) {
    if (v.postCount == null) await db.put({ ...v, postCount: 0 }, id);
    return id;
  }
  await db.put({ role: "guest", postCount: 0, ethAddress: address }, id);
  return id;
}

/** Current role for an address (defaults to guest) (sync). */
export function getRole(address) {
  return (address && nodeOf(userNodeId(address))?.role) || "guest";
}

/** Full governance node value (role, postCount, …) or null (sync). */
export function getUserNode(address) {
  return (address && nodeOf(userNodeId(address))) || null;
}

/** Subscribe to one identity's standing. cb(role, node) on every change. Returns unsub. */
export function subscribeRole(address, onChange_) {
  if (!address) return () => {};
  const id = userNodeId(address);
  const emit = () => { const v = nodeOf(id); onChange_(v?.role || "guest", v || {}); };
  emit();
  // Governance nodes carry no `type`, so listen to every change and filter by id.
  return onChange(({ id: changedId }) => { if (changedId === id) emit(); });
}

/** Live roster of every user node carrying a role (for the network view). Returns unsub. */
export function subscribeRoster(onChange_) {
  const emit = () =>
    onChange_(
      select((v) => v.role != null)
        .filter(({ id }) => id.startsWith("user:"))
        .map(({ id, value }) => ({ address: id.slice(5), role: value.role, postCount: value.postCount ?? 0 }))
        .sort((a, b) => a.address.localeCompare(b.address)),
    );
  emit();
  return onChange(emit); // governance nodes have no `type` → listen to all
}

/**
 * Re-derive postCount from the identity's live posts and write it to the governance node,
 * so the member↔trusted rule tracks reality. Deriving from the real count keeps it correct
 * across deletes, failures and re-syncs (role preserved via spread).
 */
export async function syncPostCount(address = activeAddress()) {
  if (!address) return;
  const id = userNodeId(address);
  const v = await loadUserNode(id); // waits, so we don't clobber a not-yet-synced role
  // Count from a DIRECT db query, NOT the in-memory store: the store mirror updates async,
  // so right after acls.set/delete it's off by one (it hasn't seen the just-written change
  // yet). A direct query reflects the real state → the 3rd post promotes to trusted, and
  // dropping back to 2 demotes to member, exactly as intended.
  const { results } = await db.map({ query: { type: TYPE.post, authorId: address } });
  await db.put({ ...(v ?? { role: "guest", ethAddress: address }), postCount: results.length }, id);
}
