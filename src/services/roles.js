// Governance / RBAC standing. The Security Manager creates each identity's
// `user:<address>` node on login (role `guest`, or `superadmin` if configured)
// and the governance engine — running only while a superadmin is online — rewrites
// `role` per the public rules in db/gdb.js. The app writes *metrics* (postCount)
// into that same node so the member→trusted rule can read them. db.put REPLACES
// the node, so every metric write spreads the existing value to preserve `role`.
import { db } from "../db/gdb.js";
import { activeAddress } from "./identity.js";

const userNodeId = (addr) => `user:${addr}`;

/** Ensure the active identity's governance node carries role + postCount. */
export async function ensureUserDoc(address = activeAddress()) {
  if (!address) return null;
  const id = userNodeId(address);
  const { result } = await db.get(id);
  const v = result?.value;
  if (!v || v.role == null || v.postCount == null) {
    await db.put({ role: "guest", ...v, postCount: v?.postCount ?? 0 }, id);
  }
  return id;
}

/** Current role for an address (defaults to guest). */
export async function getRole(address) {
  if (!address) return "guest";
  const { result } = await db.get(userNodeId(address));
  return result?.value?.role || "guest";
}

/** Full governance node value (role, postCount, …) or null. */
export async function getUserNode(address) {
  if (!address) return null;
  const { result } = await db.get(userNodeId(address));
  return result?.value || null;
}

/** Subscribe to one identity's standing. cb(role, node) on every change. */
export async function subscribeRole(address, onChange) {
  if (!address) return () => {};
  // db.get may invoke the callback with null (node absent/removed) — never destructure it.
  const { unsubscribe } = await db.get(userNodeId(address), (node) =>
    onChange(node?.value?.role || "guest", node?.value || {}),
  );
  return unsubscribe;
}

/** Live roster of every user node carrying a role (for the network view). */
export async function subscribeRoster(onChange) {
  const roster = new Map();
  const emit = () =>
    onChange(
      [...roster.entries()]
        .map(([id, v]) => ({ address: id.slice(5), role: v.role, postCount: v.postCount ?? 0 }))
        .sort((a, b) => a.address.localeCompare(b.address)),
    );
  const onUser = ({ id, value }) => {
    if (!id?.startsWith("user:") || !value?.role) return;
    roster.set(id, value);
    emit();
  };
  const { results, unsubscribe } = await db.map({ query: { role: { $exists: true } } }, onUser);
  for (const { id, value } of results) if (id?.startsWith("user:") && value?.role) roster.set(id, value);
  emit();
  return unsubscribe;
}

/** Count an action toward the member→trusted rule (postCount, role preserved). */
export async function recordPost(address = activeAddress()) {
  if (!address) return;
  const id = userNodeId(address);
  const { result } = await db.get(id);
  const v = result?.value ?? {};
  await db.put({ role: "guest", ...v, postCount: (v.postCount ?? 0) + 1 }, id);
}
