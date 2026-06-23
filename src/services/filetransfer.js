// 1:1 peer-to-peer file transfer over a GenosRTC data channel (never the DB). Uses
// the engine's native chunked `channel.send(buffer, target, metadata, onProgress)`
// and `progress`/`message` events, targeted at the recipient's peerId (so it's a
// real 1:1 transfer, not a broadcast). Both peers must be connected.
import { db, P2P_CHANNELS_ENABLED } from "../db/gdb.js";
import { peerIdFor } from "./roster.js";

let channel = null;
let onIncoming = null; // (data, peerId, metadata) => void
let onIncomingProgress = null; // (percent, peerId, metadata) => void

function ensureChannel() {
  if (channel) return channel;
  if (!P2P_CHANNELS_ENABLED) return null; // channels paused — see gdb.js
  channel = db.room.channel("file");
  channel.on("message", (data, peerId, metadata) => onIncoming?.(data, peerId, metadata));
  channel.on("progress", (percent, peerId, metadata) => onIncomingProgress?.(percent, peerId, metadata));
  return channel;
}

/**
 * Max transferable size. GenosRTC caps a single channel message at ~100 chunks
 * (~1.5 MB), so we reject larger files up front instead of letting send() throw.
 */
export const MAX_FILE_BYTES = 1_400_000;

/**
 * Send a file to a recipient address (1:1, targeted at its peerId) with live
 * send-progress.
 * @param {string} recipientAddress
 * @param {File} file
 * @param {(percent:number)=>void} [onProgress] 0..1
 * @returns {Promise<"sent"|"offline"|"too-large">}
 */
export async function sendFileTo(recipientAddress, file, onProgress) {
  if (!P2P_CHANNELS_ENABLED) return "offline"; // channels paused — see gdb.js
  if (file.size > MAX_FILE_BYTES) return "too-large";
  const peerId = peerIdFor(recipientAddress);
  if (!peerId) return "offline";
  const buffer = await file.arrayBuffer();
  await ensureChannel().send(
    buffer,
    peerId,
    { filename: file.name, type: file.type, size: file.size },
    (percent) => onProgress?.(percent),
  );
  return "sent";
}

/**
 * Register handlers for incoming files and their receive-progress. Both fire with
 * the sender's peerId, so the caller can scope them to the active conversation.
 * @param {(data:ArrayBuffer, peerId:string, metadata:object)=>void} onMessage
 * @param {(percent:number, peerId:string, metadata:object)=>void} onProgress
 */
export function onFile(onMessage, onProgress) {
  ensureChannel();
  onIncoming = onMessage;
  onIncomingProgress = onProgress;
}
