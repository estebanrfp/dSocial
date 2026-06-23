// Live "viewing now" presence over a GenosRTC data channel (never the DB). Each
// peer announces which target (post/community id) it's currently viewing plus its
// address (so the UI can show a name). Mirrors the cursor.html pattern: a `presence`
// room channel + peer:join/leave. On a new peer joining we re-announce, so newcomers
// learn the current state without a heartbeat (state is also re-sent on every move).
import { db, P2P_CHANNELS_ENABLED } from "../db/gdb.js";
import { activeAddress } from "./identity.js";

let channel = null;
let currentTarget = null;
const peers = new Map(); // peerId -> { address, target }
const watchers = new Set();

function notify() {
  for (const fn of watchers) fn();
}

function announce() {
  const address = activeAddress();
  if (!address) return;
  try {
    ensureChannel()?.send({ address, target: currentTarget });
  } catch {
    /* no peers connected yet — nothing to announce to */
  }
}

function ensureChannel() {
  if (channel) return channel;
  if (!P2P_CHANNELS_ENABLED) return null; // channels paused — see gdb.js
  channel = db.room.channel("presence");
  channel.on("message", (data, peerId) => {
    if (!data?.address) return;
    const isNew = !peers.has(peerId);
    if (data.target) peers.set(peerId, { address: data.address, target: data.target });
    else peers.delete(peerId);
    notify();
    // Reply to a peer we just heard from for the first time, so they learn our state.
    // Covers the join race: a peer that joins after us isn't listening yet when we
    // re-announce on peer:join, but it always announces itself once it starts viewing.
    if (isNew && data.target && currentTarget) announce();
  });
  db.room.on?.("peer:join", () => announce()); // a peer joined — tell it what we're viewing
  db.room.on?.("peer:leave", (peerId) => {
    if (peers.delete(peerId)) notify();
  });
  // Heartbeat: re-announce while viewing, so peers converge regardless of the order
  // they connected and started viewing (P2P join timing is racy and early announces,
  // sent before the link was up, are lost).
  setInterval(() => { if (currentTarget) announce(); }, 3000);
  return channel;
}

/** Announce that I'm now viewing `target` (a post/community id), or null to clear. */
export function setViewing(target) {
  if (!P2P_CHANNELS_ENABLED) return; // channels paused — see gdb.js
  ensureChannel();
  currentTarget = target;
  announce();
}

/** Addresses of OTHER peers currently viewing `target` (deduped). */
export function viewersOf(target) {
  const addrs = new Set();
  for (const { address, target: t } of peers.values()) if (t === target) addrs.add(address);
  return [...addrs];
}

/** Subscribe to presence changes; `fn()` fires on any change. Returns an unsubscribe. */
export function onPresence(fn) {
  ensureChannel();
  watchers.add(fn);
  return () => watchers.delete(fn);
}
