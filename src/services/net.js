// Live P2P peer tracker. Imported eagerly from main.js so it starts counting
// peers from app start (db.room.on only reports joins after you subscribe).
import { db } from "../db/gdb.js";

const peers = new Set();
const types = new Map(); // peerId -> declared type ('superpeer' = Fallback Server)
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn([...peers]));

db.room?.on?.("peer:join", (id, type) => {
  peers.add(id);
  if (type) types.set(id, type);
  emit();
});
db.room?.on?.("peer:leave", (id) => {
  peers.delete(id);
  types.delete(id);
  emit();
});

/** Current connected peer ids. */
export const getPeers = () => [...peers];

/** Declared type of a connected peer ('superpeer' for a Fallback Server), or undefined. */
export const getPeerType = (id) => types.get(id);

/** How many connected peers are Fallback Servers. */
export const serverCount = () => [...peers].filter((id) => types.get(id) === "superpeer").length;

/** Subscribe to peer-set changes; fires immediately with the current set. */
export function subscribePeers(fn) {
  listeners.add(fn);
  fn([...peers]);
  return () => listeners.delete(fn);
}
