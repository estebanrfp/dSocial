// Live P2P peer tracker. Imported eagerly from main.js so it starts counting
// peers from app start (db.room.on only reports joins after you subscribe).
import { db } from "../db/gdb.js";

const peers = new Set();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn([...peers]));

db.room?.on?.("peer:join", (id) => {
  peers.add(id);
  emit();
});
db.room?.on?.("peer:leave", (id) => {
  peers.delete(id);
  emit();
});

/** Current connected peer ids. */
export const getPeers = () => [...peers];

/** Subscribe to peer-set changes; fires immediately with the current set. */
export function subscribePeers(fn) {
  listeners.add(fn);
  fn([...peers]);
  return () => listeners.delete(fn);
}
