// Identity & profile via the GenosDB Security Manager. The SM owns key material,
// signs every operation and drives RBAC; this module wraps its onboarding/login
// calls and the per-identity `user` profile node (ACL-owned by the address).
import { db } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";

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

// ── Profile (user:<address> node) ────────────────────────────────────────────

/** Read a user's profile node by address, or null. */
export async function getProfile(address) {
  if (!address) return null;
  const { result } = await db.get(address);
  return result?.value?.type === TYPE.user ? result.value : null;
}

/** Ensure the active identity has a profile node; create a minimal one if missing. */
export async function ensureProfile() {
  const address = activeAddress();
  if (!address) return null;
  const existing = await getProfile(address);
  if (existing) return existing;
  const profile = { type: TYPE.user, address, displayName: "", bio: "", createdAt: Date.now() };
  await db.sm.acls.set(profile, address);
  return profile;
}

/** Update the active identity's profile (owner-only, enforced by ACLs). */
export async function updateProfile(patch) {
  const address = activeAddress();
  if (!address) throw new Error("No active identity");
  const current = (await getProfile(address)) ?? { type: TYPE.user, address, createdAt: Date.now() };
  const next = { ...current, ...patch, type: TYPE.user, address };
  await db.sm.acls.set(next, address);
  return next;
}

/**
 * Derive a user's karma: net (up − down) across every vote on their posts and
 * comments. Two-step join (votes don't carry the author): find the user's content
 * ids, then aggregate the votes referencing them. Never written onto a node.
 */
export async function getKarma(userId) {
  if (!userId) return 0;
  const [posts, comments] = await Promise.all([
    db.map({ query: { type: TYPE.post, authorId: userId } }),
    db.map({ query: { type: TYPE.comment, authorId: userId } }),
  ]);
  const postIds = posts.results.map((n) => n.value.id);
  const commentIds = comments.results.map((n) => n.value.id);
  if (!postIds.length && !commentIds.length) return 0;

  const queries = [];
  if (postIds.length) queries.push(db.map({ query: { type: TYPE.postVote, postId: { $in: postIds } } }));
  if (commentIds.length) queries.push(db.map({ query: { type: TYPE.commentVote, commentId: { $in: commentIds } } }));

  let karma = 0;
  for (const { results } of await Promise.all(queries)) {
    for (const n of results) karma += n.value.direction === "up" ? 1 : -1;
  }
  return karma;
}
