// Encrypted group chat rooms. A room has a shared AES-256 key (random for
// invite rooms, PBKDF2-derived for password rooms) — GenosDB's per-user SM
// encryption doesn't cover group secrets, so we manage the key app-side in a
// local vault. Room meta and each message are AES-encrypted; every node is
// ACL-owned by its author (zero-trust transport — no peer can forge or delete
// another's message). Membership is signed `roomMember` nodes, so counts derive.
import { db } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";
import { select, value as nodeOf, onChange } from "../db/store.js";
import { activeAddress } from "./identity.js";
import * as aes from "../utils/encryption.js";

const VAULT = "interpoll-rooms";
const salt = (roomId) => `${roomId}:interpoll-vanilla-v2`;

const readVault = () => {
  try {
    return JSON.parse(localStorage.getItem(VAULT)) || [];
  } catch {
    return [];
  }
};
const writeVault = (list) => localStorage.setItem(VAULT, JSON.stringify(list));
const storeRoomKey = (entry) => writeVault([...readVault().filter((e) => e.id !== entry.id), entry]);
const getRoomKey = (id) => readVault().find((e) => e.id === id);
const removeRoomKey = (id) => writeVault(readVault().filter((e) => e.id !== id));

/** Create an encrypted room. Returns the room + an invite token (the url-safe AES key). */
export async function createRoom(name, description = "", password = "") {
  const creatorId = activeAddress();
  if (!creatorId) throw new Error("No active identity");
  const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const method = password ? "password" : "invite";
  const hint = password ? "Password-protected" : "Invite-only";
  const aesKey = password ? await aes.deriveKeyFromPassword(password, salt(roomId)) : await aes.generateKey();
  const encryptedMeta = await aes.encrypt(JSON.stringify({ name, description, creatorId }), aesKey);
  const createdAt = Date.now();
  await db.sm.acls.set({ type: TYPE.chatRoom, id: roomId, isEncrypted: true, encryptionHint: hint, encryptedMeta, createdAt }, roomId);
  await db.sm.acls.set({ type: TYPE.roomMember, roomId, member: creatorId, joinedAt: createdAt }, `roomMember:${roomId}:${creatorId}`);
  storeRoomKey({ id: roomId, key: await aes.exportKey(aesKey), method, label: name, joinedAt: createdAt });
  return {
    room: { id: roomId, name, description, creatorId, encryptionHint: hint, createdAt, memberCount: 1 },
    inviteToken: password ? "" : await aes.exportKeyUrl(aesKey),
  };
}

/** Join a room by id + invite token (or password). The key is verified by decrypting meta. */
export async function joinRoom(roomId, keyOrPassword, method = "invite") {
  const aesKey = method === "password" ? await aes.deriveKeyFromPassword(keyOrPassword, salt(roomId)) : await aes.importKeyUrl(keyOrPassword);
  const room = nodeOf(roomId);
  if (!room?.encryptedMeta) throw new Error("Room not found — has it synced yet?");
  let meta;
  try {
    meta = JSON.parse(await aes.decrypt(room.encryptedMeta, aesKey));
  } catch {
    throw new Error("Invalid key or password — could not decrypt this room.");
  }
  storeRoomKey({ id: roomId, key: await aes.exportKey(aesKey), method, label: meta.name, joinedAt: Date.now() });
  const me = activeAddress();
  if (me) await db.sm.acls.set({ type: TYPE.roomMember, roomId, member: me, joinedAt: Date.now() }, `roomMember:${roomId}:${me}`);
  return { id: roomId, name: meta.name, description: meta.description, creatorId: meta.creatorId, encryptionHint: room.encryptionHint || "", createdAt: room.createdAt, memberCount: await countRoomMembers(roomId) };
}

/** Send an AES-encrypted message to a joined room. */
export async function sendRoomMessage(roomId, text, senderName = "") {
  const stored = getRoomKey(roomId);
  if (!stored) throw new Error("You haven't joined this room.");
  const senderId = activeAddress();
  const aesKey = await aes.importKey(stored.key);
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const encryptedContent = await aes.encrypt(JSON.stringify({ text, senderId, senderName }), aesKey);
  await db.sm.acls.set({ type: TYPE.chatMessage, id, roomId, senderId, encryptedContent, timestamp: Date.now() }, id);
  return id;
}

/** Live, auto-decrypting subscription to a room's messages. onChange(messages[]). */
export async function subscribeRoomMessages(roomId, onChange_) {
  const stored = getRoomKey(roomId);
  if (!stored) throw new Error("You haven't joined this room.");
  const aesKey = await aes.importKey(stored.key);
  const me = activeAddress();
  const byId = new Map();
  const emit = () => onChange_([...byId.values()].sort((a, b) => a.timestamp - b.timestamp));
  const ingest = async (id, value) => {
    if (!value.encryptedContent) return;
    try {
      const content = JSON.parse(await aes.decrypt(value.encryptedContent, aesKey));
      byId.set(id, { id, text: content.text, senderId: content.senderId, senderName: content.senderName, mine: content.senderId === me, timestamp: value.timestamp });
      emit();
    } catch { /* not decryptable with this key — skip */ }
  };
  for (const { id, value } of select((v) => v.type === TYPE.chatMessage && v.roomId === roomId)) await ingest(id, value);
  emit();
  return onChange(({ id, value, action }) => {
    if (action === "removed") { if (byId.delete(id)) emit(); return; }
    if (value?.type === TYPE.chatMessage && value.roomId === roomId) ingest(id, value);
  }, TYPE.chatMessage);
}

/** Derive a room's member count from its signed roomMember nodes. */
export function countRoomMembers(roomId) {
  return select((n) => n.type === TYPE.roomMember && n.roomId === roomId).length || 1;
}

/** List rooms this identity has joined (from the local key vault), newest first. */
export async function listJoinedRooms() {
  const out = [];
  for (const stored of readVault()) {
    const room = nodeOf(stored.id);
    let name = stored.label;
    let description = "";
    let creatorId = "";
    if (room?.encryptedMeta) {
      try {
        const meta = JSON.parse(await aes.decrypt(room.encryptedMeta, await aes.importKey(stored.key)));
        ({ name, description, creatorId } = meta);
      } catch { /* keep the stored label */ }
    }
    out.push({ id: stored.id, name, description, creatorId, encryptionHint: room?.encryptionHint || "", createdAt: room?.createdAt || stored.joinedAt, memberCount: await countRoomMembers(stored.id) });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Fire onChange on any room membership/message change (keeps the list + counts live). */
export function subscribeRooms(onChange_) {
  return onChange(() => onChange_(), [TYPE.roomMember, TYPE.chatRoom]);
}

/** Am I a member of this room (local vault check)? */
export const hasJoined = (roomId) => !!getRoomKey(roomId);

/** Rebuild the shareable invite for a room I hold a key for: `roomId#urlKey`. */
export async function roomInviteToken(roomId) {
  const stored = getRoomKey(roomId);
  if (!stored) throw new Error("You haven't joined this room.");
  if (stored.method === "password") return roomId; // share the room id + the password out-of-band
  return `${roomId}#${await aes.exportKeyUrl(await aes.importKey(stored.key))}`;
}

/** Parse a pasted invite string into { roomId, token }. */
export const parseInvite = (str) => {
  const [roomId, token = ""] = String(str).trim().split("#");
  return { roomId, token };
};

/** Leave a room: delete my membership node + drop the local key. */
export async function leaveRoom(roomId) {
  const me = activeAddress();
  if (me) await db.sm.acls.delete(`roomMember:${roomId}:${me}`).catch(() => {});
  removeRoomKey(roomId);
}
