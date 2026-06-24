// Communities. Created/owned via node ACLs (creator = owner); membership and the
// moderator list are signed nodes; member counts are derived from membership
// nodes. Ported to vanilla from the fork's CommunityService.
import { db } from "../db/gdb.js";
import { TYPE, communityId, membershipId } from "../db/schema.js";
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

/** Count a community's members from its signed membership nodes. */
export async function countMembers(id) {
  const { results } = await db.map({ query: { type: TYPE.membership, communityId: id } });
  return results.length;
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

/** Read one community with its derived member count, or null. */
export async function getCommunity(id) {
  const { result } = await db.get(id);
  if (result?.value?.type !== TYPE.community) return null;
  return build(result.value, await countMembers(id));
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

/** Whether the active identity is a member of a community. */
export async function isMember(id) {
  const me = activeAddress();
  if (!me) return false;
  const { result } = await db.get(membershipId(id, me));
  return result?.value?.type === TYPE.membership;
}

/** Add a moderator (owner-only, enforced by the ACL middleware). */
export async function addModerator(id, address) {
  const { result } = await db.get(id);
  if (!result?.value) throw new Error("Community not found");
  const current = Array.isArray(result.value.moderators) ? result.value.moderators : [];
  if (current.some((m) => m.toLowerCase() === address.toLowerCase())) return;
  // acls.set replaces the whole node value — spread to preserve name/description/etc.
  await db.sm.acls.set({ ...result.value, moderators: [...current, address] }, id);
}

/** Remove a moderator (owner-only). */
export async function removeModerator(id, address) {
  const { result } = await db.get(id);
  if (!result?.value) return;
  const current = Array.isArray(result.value.moderators) ? result.value.moderators : [];
  await db.sm.acls.set(
    { ...result.value, moderators: current.filter((m) => m.toLowerCase() !== address.toLowerCase()) },
    id,
  );
}

/**
 * Subscribe to all communities live. `onChange(communities[])` fires on every change
 * (newest first). Watches BOTH community nodes AND membership nodes, because the member
 * count derives from memberships — without the membership watch a join only showed up on
 * reload (it never touches the community node). Mirrors the fork's subscribeToCommunitiesLive.
 * Returns an unsubscribe function.
 */
export async function subscribeCommunities(onChange) {
  const byId = new Map();
  const emit = () =>
    onChange([...byId.values()].sort((a, b) => b.createdAt - a.createdAt));
  const refresh = async (id) => {
    const { result } = await db.get(id);
    if (result?.value?.type === TYPE.community) byId.set(id, build(result.value, await countMembers(id)));
    else byId.delete(id);
    emit();
  };

  const { results, unsubscribe: communityUnsub } = await db.map(
    { query: { type: TYPE.community } },
    ({ id, value, action }) => {
      if (action === "removed") { byId.delete(id); emit(); }
      else if (value?.type === TYPE.community) refresh(id);
    },
  );
  const { unsubscribe: memberUnsub } = await db.map(
    { query: { type: TYPE.membership } },
    ({ value }) => { const cid = value?.communityId; if (cid && byId.has(cid)) refresh(cid); },
  );
  for (const node of results) {
    if (node.value?.type === TYPE.community) {
      byId.set(node.id, build(node.value, await countMembers(node.id)));
    }
  }
  emit();
  return () => { communityUnsub?.(); memberUnsub?.(); };
}
