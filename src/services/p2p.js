// ONE GenosRTC data channel for the app's peer-to-peer ephemeral features — the same
// lesson as the store (ONE db.map): opening several channels degrades the DB's own sync,
// so everything shares a single `app` channel, multiplexed by message `kind`. Opened once
// at startup. To add typing / presence later, route them through THIS channel — never
// open a second one.
import { db } from "../db/gdb.js";
import { activeAddress } from "./identity.js";

let channel = null;
const byPeer = new Map(); // peerId -> address
const byAddr = new Map(); // address -> peerId
const rosterWatchers = new Set();
let onFileMsg = null; // (data, peerId, metadata) => void
let onFileProgress = null; // (percent, peerId, metadata) => void

const notifyRoster = () => { for (const fn of rosterWatchers) fn(); };

function announce() {
  const address = activeAddress();
  if (!address) return;
  try { ensureChannel().send({ kind: "whoami", address }); } catch { /* no peers yet */ }
}

function ensureChannel() {
  if (channel) return channel;
  channel = db.room.channel("app"); // ≤12 bytes; the ONE app channel
  channel.on("message", (data, peerId, metadata) => {
    if (metadata?.kind === "file") { onFileMsg?.(data, peerId, metadata); return; } // chunked file payload
    if (data?.kind === "whoami" && data.address) {
      const isNew = !byPeer.has(peerId);
      byPeer.set(peerId, data.address);
      byAddr.set(data.address, peerId);
      notifyRoster();
      if (isNew) announce(); // reply so a newly-heard peer learns us too
    }
  });
  channel.on("progress", (percent, peerId, metadata) => {
    if (metadata?.kind === "file") onFileProgress?.(percent, peerId, metadata);
  });
  db.room.on?.("peer:join", () => announce());
  db.room.on?.("peer:leave", (peerId) => {
    const addr = byPeer.get(peerId);
    if (addr !== undefined) {
      byPeer.delete(peerId);
      if (byAddr.get(addr) === peerId) byAddr.delete(addr);
      notifyRoster();
    }
  });
  setInterval(announce, 4000); // heartbeat for roster convergence
  return channel;
}

/** Open the app channel + announce our identity (idempotent; call once at startup). */
export function startP2P() {
  ensureChannel();
  announce();
}

// ── Roster: address ↔ peerId (needed to target a 1:1 transfer) ────────────────
/** The GenosRTC peerId for an address if it's connected, else null. */
export const peerIdFor = (address) => (address && byAddr.get(address)) || null;
/** Whether `address` is currently a connected peer. */
export const isOnline = (address) => !!address && byAddr.has(address);
/** Subscribe to roster changes; `fn()` fires on any change. Returns an unsubscribe. */
export function onRoster(fn) {
  rosterWatchers.add(fn);
  return () => rosterWatchers.delete(fn);
}

// ── 1:1 file transfer (chunked by the engine) ────────────────────────────────
/** GenosRTC caps a single channel message at ~100 chunks (~1.5 MB); reject larger up front. */
export const MAX_FILE_BYTES = 1_400_000;

/**
 * Send a file to a recipient address (1:1, targeted at its peerId) with live progress.
 * @returns {Promise<"sent"|"offline"|"too-large">}
 */
export async function sendFileTo(recipientAddress, file, onProgress) {
  if (file.size > MAX_FILE_BYTES) return "too-large";
  const peerId = peerIdFor(recipientAddress);
  if (!peerId) return "offline";
  const buffer = await file.arrayBuffer();
  await ensureChannel().send(
    buffer,
    peerId,
    { kind: "file", filename: file.name, type: file.type, size: file.size },
    (percent) => onProgress?.(percent),
  );
  return "sent";
}

/** Register handlers for incoming files + their receive-progress (scoped by the caller). */
export function onFile(onMessage, onProgress) {
  ensureChannel();
  onFileMsg = onMessage;
  onFileProgress = onProgress;
}
