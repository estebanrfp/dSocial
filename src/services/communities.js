// Communities. Created/owned via node ACLs (creator = owner); membership and the
// moderator list are signed nodes; member counts derive from membership nodes. Reads
// derive synchronously from the in-memory store (the app's single db.map). Ported to
// vanilla from the fork's CommunityService.
import { db } from "../db/gdb.js";
import { TYPE, communityId, membershipId } from "../db/schema.js";
import { select, value as nodeOf, onChange } from "../db/store.js";
import { activeAddress } from "./identity.js";

/** Map a stored community node + derived count into the UI shape. */
function build(value, memberCount) {
  return {
    id: value.id,
    name: value.name,
    displayName: value.displayName || value.name,
    description: value.description || "",
    rules: Array.isArray(value.rules) ? value.rules : [],
    creatorId: value.creatorId,
    owner: value.owner,
    moderators: Array.isArray(value.moderators) ? value.moderators : [],
    createdAt: value.createdAt ?? 0,
    isEncrypted: !!value.isEncrypted,
    memberCount,
  };
}

/** Count a community's members from its signed membership nodes (sync, from the store). */
export function countMembers(id) {
  return select((n) => n.type === TYPE.membership && n.communityId === id).length;
}

/** Create a public community: the creator becomes ACL owner and first member. */
export async function createCommunity({ name, displayName, description, rules }) {
  const me = activeAddress();
  if (!me) throw new Error("No active identity");
  const id = communityId(name);
  const createdAt = Date.now();
  const record = {
    type: TYPE.community,
    id,
    name,
    displayName: displayName || name,
    description: description || "",
    rules: rules ?? [],
    creatorId: me,
    createdAt,
    postCount: 0,
    moderators: [],
  };
  await db.sm.acls.set(record, id);
  await db.sm.acls.set(
    { type: TYPE.membership, communityId: id, member: me, joinedAt: createdAt },
    membershipId(id, me),
  );
  return build(record, 1);
}

/** Read one community with its derived member count, or null (sync, from the store). */
export function getCommunity(id) {
  const v = nodeOf(id);
  return v?.type === TYPE.community ? build(v, countMembers(id)) : null;
}

/** Join a community (idempotent per identity — deterministic membership id). */
export async function joinCommunity(id) {
  const me = activeAddress();
  if (!me) throw new Error("No active identity");
  await db.sm.acls.set(
    { type: TYPE.membership, communityId: id, member: me, joinedAt: Date.now() },
    membershipId(id, me),
  );
}

/** Whether the active identity is a member of a community (sync, from the store). */
export function isMember(id) {
  const me = activeAddress();
  if (!me) return false;
  return nodeOf(membershipId(id, me))?.type === TYPE.membership;
}

/** Add a moderator (owner-only, enforced by the ACL middleware). */
export async function addModerator(id, address) {
  const v = nodeOf(id);
  if (!v) throw new Error("Community not found");
  const current = Array.isArray(v.moderators) ? v.moderators : [];
  if (current.some((m) => m.toLowerCase() === address.toLowerCase())) return;
  // acls.set replaces the whole node value — spread to preserve name/description/etc.
  await db.sm.acls.set({ ...v, moderators: [...current, address] }, id);
}

/** Remove a moderator (owner-only). */
export async function removeModerator(id, address) {
  const v = nodeOf(id);
  if (!v) return;
  const current = Array.isArray(v.moderators) ? v.moderators : [];
  await db.sm.acls.set(
    { ...v, moderators: current.filter((m) => m.toLowerCase() !== address.toLowerCase()) },
    id,
  );
}

/**
 * Subscribe to all communities live (newest first). Member counts derive from membership
 * nodes, so the store fires this on any community OR membership change — a join updates
 * the count live. No db.map of its own (the app shares one). Returns an unsubscribe.
 */
export function subscribeCommunities(onChange_) {
  const emit = () => onChange_(
    select((v) => v.type === TYPE.community)
      .map(({ value }) => build(value, countMembers(value.id)))
      .sort((a, b) => b.createdAt - a.createdAt),
  );
  emit();
  return onChange(emit, [TYPE.community, TYPE.membership]);
}
