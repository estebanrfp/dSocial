// Identity & profile via the GenosDB Security Manager. The SM owns key material, signs
// every operation and drives RBAC; this module wraps its onboarding/login calls and the
// per-identity `user` profile node (ACL-owned by the address). Derived reads (stats,
// karma) come synchronously from the in-memory store (the app's single db.map).
import { db } from "../db/gdb.js";
import { TYPE, isAuthenticVote } from "../db/schema.js";
import { select, value as nodeOf } from "../db/store.js";

// ── Onboarding / session ─────────────────────────────────────────────────────

/** Create a brand-new volatile identity. @returns {Promise<{address,mnemonic,privateKey}|null>} */
export const createIdentity = () => db.sm.startNewUserRegistration();

/** Log in / recover an identity from a BIP39 mnemonic phrase. */
export const recoverWithMnemonic = (phrase) =>
  db.sm.loginOrRecoverUserWithMnemonic(String(phrase).trim().toLowerCase());

/** Protect the current volatile identity with a WebAuthn passkey, starting a session. */
export const protectWithWebAuthn = () => db.sm.protectCurrentIdentityWithWebAuthn();

/** Interactive WebAuthn login for a previously registered passkey (may prompt). */
export const loginWithWebAuthn = () => db.sm.loginCurrentUserWithWebAuthn();

/** Whether a WebAuthn passkey is registered on this device. */
export const hasWebAuthn = () => db.sm.hasExistingWebAuthnRegistration();

/** Log out: clear the signing session + WebAuthn resume flag. */
export const logout = () => db.sm.clearSecurity();

/** Active Ethereum address, or null. */
export const activeAddress = () => db.sm.getActiveEthAddress?.() ?? null;

// ── Profile (the `user` node, id = address) ──────────────────────────────────

/** Read a user's profile node by address, or null (sync, from the store). */
export function getProfile(address) {
  if (!address) return null;
  const v = nodeOf(address);
  return v?.type === TYPE.user ? v : null;
}

/** Ensure the active identity has a profile node; create a minimal one if missing. */
export async function ensureProfile() {
  const address = activeAddress();
  if (!address) return null;
  const existing = getProfile(address);
  if (existing) return existing;
  const profile = { type: TYPE.user, address, displayName: "", bio: "", createdAt: Date.now() };
  await db.sm.acls.set(profile, address);
  return profile;
}

/** Update the active identity's profile (owner-only, enforced by ACLs). */
export async function updateProfile(patch) {
  const address = activeAddress();
  if (!address) throw new Error("No active identity");
  const current = getProfile(address) ?? { type: TYPE.user, address, createdAt: Date.now() };
  const next = { ...current, ...patch, type: TYPE.user, address };
  await db.sm.acls.set(next, address);
  return next;
}

/** Aggregate public stats for a profile — all derived from the store, never stored (sync). */
export function getUserStats(userId) {
  if (!userId) return { posts: 0, comments: 0, communities: 0, karma: 0 };
  return {
    posts: select((v) => v.type === TYPE.post && v.authorId === userId).length,
    comments: select((v) => v.type === TYPE.comment && v.authorId === userId).length,
    communities: select((v) => v.type === TYPE.membership && v.member === userId).length,
    karma: getKarma(userId),
  };
}

/** A user's posts (newest first) for their profile page (sync). */
export function getUserPosts(userId) {
  if (!userId) return [];
  return select((v) => v.type === TYPE.post && v.authorId === userId)
    .map(({ value }) => value)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * Derive a user's karma: net (up − down) across every authentic vote on their posts and
 * comments, from the in-memory store. Self-votes don't count (reputation comes from
 * others). Sync — never written onto a node.
 */
export function getKarma(userId) {
  if (!userId) return 0;
  const postIds = new Set(select((v) => v.type === TYPE.post && v.authorId === userId).map(({ value }) => value.id));
  const commentIds = new Set(select((v) => v.type === TYPE.comment && v.authorId === userId).map(({ value }) => value.id));
  if (!postIds.size && !commentIds.size) return 0;

  let karma = 0;
  for (const { value } of select((v) => v.type === TYPE.postVote && postIds.has(v.postId))) {
    if (!isAuthenticVote(value) || value.voter === userId) continue; // unforgeable; no self-votes
    karma += value.direction === "up" ? 1 : -1;
  }
  for (const { value } of select((v) => v.type === TYPE.commentVote && commentIds.has(v.commentId))) {
    if (!isAuthenticVote(value) || value.voter === userId) continue;
    karma += value.direction === "up" ? 1 : -1;
  }
  return karma;
}
