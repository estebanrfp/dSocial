// 1:1 end-to-end encrypted direct messages over GenosDB. Each identity has an
// RSA-OAEP keypair (private key kept in IndexedDB, public key published as a
// `chatKey` node). A message is encrypted for the recipient AND the sender, then
// written as an ACL-owned `dm` node; the recipient is granted `write` (to mark it
// read) but not delete. The synced node IS the delivery. Ported from the fork.
import { db, P2P_CHANNELS_ENABLED } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";
import { activeAddress } from "./identity.js";
import { idbGet, idbSet } from "../utils/keystore.js";

let keyPair = null;
let myId = null;

const roomId = (a, b) => [a, b].sort().join(":");
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function loadOrGenKeyPair(userId) {
  const stored = await idbGet(`chatkey:${userId}`);
  if (stored?.publicKey && stored?.privateKey) return stored;
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    false,
    ["encrypt", "decrypt"],
  );
  await idbSet(`chatkey:${userId}`, pair);
  return pair;
}
const exportPub = async (pair) => b64(await crypto.subtle.exportKey("spki", pair.publicKey));
const importPub = (key) => crypto.subtle.importKey("spki", unb64(key), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
const encrypt = async (msg, pub) => b64(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, new TextEncoder().encode(msg)));
const decrypt = async (cipher) => new TextDecoder().decode(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, keyPair.privateKey, unb64(cipher)));

/** Init chat for the active identity: load/generate the keypair, publish the key. */
export async function initChat() {
  myId = activeAddress();
  if (!myId) throw new Error("No active identity");
  keyPair = await loadOrGenKeyPair(myId);
  const pub = await exportPub(keyPair);
  const { result } = await db.get(`chatKey:${myId}`);
  if (result?.value?.key !== pub) {
    await db.sm.acls.set({ type: "chatKey", userId: myId, key: pub }, `chatKey:${myId}`);
  }
}

async function recipientPubKey(recipientId) {
  const { result } = await db.get(`chatKey:${recipientId}`);
  const key = result?.value?.key;
  if (!key) throw new Error("This user hasn't opened chat yet — no public key to encrypt to.");
  return importPub(key);
}

/** Send an end-to-end encrypted DM (encrypted for recipient + self). */
export async function sendMessage(recipientId, message) {
  if (!keyPair) await initChat();
  const rk = await recipientPubKey(recipientId);
  const encryptedForRecipient = await encrypt(message, rk);
  const encryptedForSender = await encrypt(message, keyPair.publicKey);
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  await db.sm.acls.set(
    {
      type: TYPE.dm, id, roomId: roomId(myId, recipientId), senderId: myId, recipientId,
      encryptedForRecipient, encryptedForSender, timestamp: Date.now(), read: false,
    },
    id,
  );
  await db.sm.acls.grant(id, recipientId, "write");
  return id;
}

/** Subscribe to the conversation with `peerId`, decrypting live. onChange(messages[]). */
export async function subscribeConversation(peerId, onChange) {
  if (!keyPair) await initChat();
  const rid = roomId(myId, peerId);
  const byId = new Map();
  const emit = () => onChange([...byId.values()].sort((a, b) => a.timestamp - b.timestamp));
  const handle = async ({ id, value, action }) => {
    if (action === "removed") { byId.delete(id); emit(); return; }
    if (value?.type !== TYPE.dm || value.roomId !== rid) return;
    const mine = value.senderId === myId;
    const cipher = mine ? value.encryptedForSender : value.encryptedForRecipient;
    try {
      byId.set(id, { id, from: value.senderId, mine, text: await decrypt(cipher), timestamp: value.timestamp });
      emit();
    } catch { /* a message from a previous keypair — skip */ }
  };
  const { results, unsubscribe } = await db.map({ query: { type: TYPE.dm, roomId: rid } }, handle);
  for (const node of results) await handle({ id: node.id, value: node.value, action: "added" });
  emit();
  return unsubscribe;
}

/** Fire onChange whenever a DM involving me is added/removed (keeps the list live). */
export async function subscribeInbox(onChange) {
  if (!myId) myId = activeAddress();
  const { unsubscribe } = await db.map({ query: { type: TYPE.dm } }, ({ value, action }) => {
    if (action !== "added" && action !== "removed") return;
    if (value && (value.senderId === myId || value.recipientId === myId)) onChange();
  });
  return unsubscribe;
}

/** List conversation peers (from existing DMs), most recent first. */
export async function listConversations() {
  if (!myId) myId = activeAddress();
  const { results } = await db.map({ query: { type: TYPE.dm } });
  const peers = new Map();
  for (const n of results) {
    const v = n.value;
    if (v.senderId !== myId && v.recipientId !== myId) continue;
    const peer = v.senderId === myId ? v.recipientId : v.senderId;
    if (!peers.has(peer) || v.timestamp > peers.get(peer)) peers.set(peer, v.timestamp);
  }
  return [...peers.entries()].map(([id, lastAt]) => ({ id, lastAt })).sort((a, b) => b.lastAt - a.lastAt);
}

// ── Ephemeral typing indicators (a GenosRTC data channel, never the DB) ───────
// Mirrors the fork's chatService: one `chat-typing` room channel carries
// { from, to, isTyping }; the receiver keeps only signals addressed to it. A single
// module-level handler dispatches to the active conversation, so we never stack
// listeners (channel.on has no off). Signals are best-effort — dropped if no peers.
let typingChannel = null;
const typingCallbacks = new Map(); // peerId -> (isTyping) => void

function ensureTypingChannel() {
  if (typingChannel) return typingChannel;
  if (!P2P_CHANNELS_ENABLED) return null; // channels paused — see gdb.js
  typingChannel = db.room.channel("chat-typing");
  typingChannel.on("message", (data) => {
    if (data?.to !== myId) return;
    typingCallbacks.get(data.from)?.(!!data.isTyping);
  });
  return typingChannel;
}

/**
 * Subscribe to `peerId`'s typing state; `onTyping(isTyping)` fires on change. The
 * indicator **auto-hides** after 4s of silence — we never rely on a "false"
 * arriving, because the sender may navigate away mid-type and never send it (this
 * was the "X is typing forever" bug). The sender re-asserts "true" on every
 * keystroke, so it stays up while they actually type. One callback per peer (not a
 * single global), so switching threads is clean. Returns an unsubscribe.
 */
export function subscribeTyping(peerId, onTyping) {
  if (!myId) myId = activeAddress();
  ensureTypingChannel();
  let hideTimer = null;
  typingCallbacks.set(peerId, (isTyping) => {
    clearTimeout(hideTimer);
    onTyping(isTyping);
    if (isTyping) hideTimer = setTimeout(() => onTyping(false), 4000);
  });
  return () => {
    clearTimeout(hideTimer);
    typingCallbacks.delete(peerId);
  };
}

/** Tell `recipientId` whether I'm typing (ephemeral; no-op if no peers are connected). */
export function sendTyping(recipientId, isTyping) {
  if (!myId) myId = activeAddress();
  try { ensureTypingChannel()?.send({ from: myId, to: recipientId, isTyping: !!isTyping }); } catch { /* no peers yet */ }
}
