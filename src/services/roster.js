// Live roster of connected peers: address ↔ peerId. 1:1 features (file transfer)
// need a peer's GenosRTC peerId to target it, but the app only knows Ethereum
// addresses — this bridges the two. Each peer announces its address over a `whoami`
// room channel on join + a heartbeat; peer:leave drops it. Same convergence pattern
// as presence (a one-shot announce is lost before the P2P link is up).
import { db } from "../db/gdb.js";
import { activeAddress } from "./identity.js";

let channel = null;
const byPeer = new Map(); // peerId -> address
const byAddr = new Map(); // address -> peerId
const watchers = new Set();

function notify() {
  for (const fn of watchers) fn();
}

function announce() {
  const address = activeAddress();
  if (!address) return;
  try {
    ensureChannel().send({ address });
  } catch {
    /* no peers yet */
  }
}

function ensureChannel() {
  if (channel) return channel;
  channel = db.room.channel("whoami");
  channel.on("message", (data, peerId) => {
    if (!data?.address) return;
    const isNew = !byPeer.has(peerId);
    byPeer.set(peerId, data.address);
    byAddr.set(data.address, peerId);
    notify();
    if (isNew) announce(); // reply so a newly-heard peer learns us too
  });
  db.room.on?.("peer:join", () => announce());
  db.room.on?.("peer:leave", (peerId) => {
    const addr = byPeer.get(peerId);
    if (addr !== undefined) {
      byPeer.delete(peerId);
      if (byAddr.get(addr) === peerId) byAddr.delete(addr);
      notify();
    }
  });
  setInterval(announce, 4000); // heartbeat for convergence
  return channel;
}

/** Start announcing our identity + tracking peers (idempotent; call once at startup). */
export function startRoster() {
  ensureChannel();
  announce();
}

/** The GenosRTC peerId for an address if it's connected, else null. */
export function peerIdFor(address) {
  return (address && byAddr.get(address)) || null;
}

/** Whether `address` is currently a connected peer. */
export function isOnline(address) {
  return !!address && byAddr.has(address);
}

/** Subscribe to roster changes; `fn()` fires on any change. Returns an unsubscribe. */
export function onRoster(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}
