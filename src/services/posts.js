// Posts + up/down votes. Each post is an ACL-owned node (author = owner); each
// vote is a deterministic, ACL-owned node so scores derive from signed votes (no
// mutable counter to corrupt). Ported from the fork's PostService.
import { db } from "../db/gdb.js";
import { TYPE, newId, postVoteId } from "../db/schema.js";
import { activeAddress } from "./identity.js";
import { grantCommunityModerators } from "./moderation.js";
import { syncPostCount } from "./roles.js";

function tally(votes) {
  let up = 0, down = 0;
  for (const v of votes) {
    if (v.direction === "up") up++;
    else if (v.direction === "down") down++;
  }
  return { upvotes: up, downvotes: down, score: up - down };
}

async function loadVotes(postId) {
  const { results } = await db.map({ query: { type: TYPE.postVote, postId } });
  return results.map((n) => ({ voter: n.value.voter, direction: n.value.direction }));
}
async function countComments(postId) {
  const { results } = await db.map({ query: { type: TYPE.comment, postId } });
  return results.length;
}

function base(value) {
  return {
    id: value.id,
    communityId: value.communityId,
    authorId: value.authorId,
    title: value.title || "",
    content: value.content || "",
    imageId: value.imageId,
    createdAt: value.createdAt ?? 0,
    editedAt: value.editedAt,
  };
}
async function build(value) {
  return { ...base(value), ...tally(await loadVotes(value.id)), commentCount: await countComments(value.id) };
}

/** Create a post (author = ACL owner; grants moderators delete). */
export async function createPost({ communityId, title, content, imageId }) {
  const me = activeAddress();
  if (!me) throw new Error("No active identity");
  const id = newId("post");
  const record = {
    type: TYPE.post, id, communityId, authorId: me,
    title, content: content || "", imageId, createdAt: Date.now(),
  };
  await db.sm.acls.set(record, id);
  await grantCommunityModerators(id, communityId);
  syncPostCount(me).catch(() => {}); // re-derive postCount for the member→trusted rule
  return { ...base(record), upvotes: 0, downvotes: 0, score: 0, commentCount: 0 };
}

/** Edit a post's title/content/image (owner only — enforced by ACLs). Spreads the
 *  existing node so votes/comments/ownership are untouched. */
export async function editPost(postId, { title, content, imageId }) {
  const { result } = await db.get(postId);
  const v = result?.value;
  if (v?.type !== TYPE.post) throw new Error("Post not found");
  const next = { ...v, title: title ?? v.title, content: content ?? "", editedAt: Date.now() };
  if (imageId !== undefined) next.imageId = imageId;
  await db.sm.acls.set(next, postId);
  return base(next);
}

/** Read one post with derived score + comment count, or null. */
export async function getPost(postId) {
  const { result } = await db.get(postId);
  if (result?.value?.type !== TYPE.post) return null;
  return build(result.value);
}

/**
 * Delete a post (owner or delegated moderator, enforced by ACLs). When the author
 * deletes their own post, re-derive their postCount so dropping below the
 * threshold demotes trusted→member (only the owner can write their own user node).
 */
export async function deletePost(postId) {
  const me = activeAddress();
  const { result } = await db.get(postId);
  const authorId = result?.value?.authorId;
  await db.sm.acls.delete(postId);
  if (me && me === authorId) syncPostCount(me).catch(() => {});
}

/** Cast or change an up/down vote (one signed vote per identity). */
export async function voteOnPost(postId, direction) {
  const voter = activeAddress();
  if (!voter) throw new Error("No active identity");
  await db.sm.acls.set(
    { type: TYPE.postVote, postId, voter, direction, createdAt: Date.now() },
    postVoteId(postId, voter),
  );
}

/** Remove the active identity's vote. */
export async function removePostVote(postId) {
  const voter = activeAddress();
  if (voter) await db.sm.acls.delete(postVoteId(postId, voter));
}

/** The active identity's vote direction on a post ('up'|'down'|null). */
export async function myPostVote(postId) {
  const voter = activeAddress();
  if (!voter) return null;
  const { result } = await db.get(postVoteId(postId, voter));
  return result?.value?.type === TYPE.postVote ? result.value.direction : null;
}

/**
 * Subscribe to a community's posts live, with scores/comment counts re-derived
 * when votes or comments change. `onChange(posts[])` newest first. Returns unsub.
 */
export async function subscribePosts(communityId, onChange) {
  const byId = new Map();
  const emit = () => onChange([...byId.values()].sort((a, b) => b.createdAt - a.createdAt));
  const refresh = async (id) => {
    const p = await getPost(id);
    if (p) byId.set(id, p);
    else byId.delete(id);
    emit();
  };

  const { results, unsubscribe: postUnsub } = await db.map(
    { query: { type: TYPE.post, communityId } },
    ({ id, value, action }) => {
      if (action === "removed") { byId.delete(id); emit(); }
      else if (value?.type === TYPE.post) refresh(id);
    },
  );
  const onRelated = ({ value }) => {
    const pid = value?.postId;
    if (pid && byId.has(pid)) refresh(pid);
  };
  const { unsubscribe: voteUnsub } = await db.map({ query: { type: TYPE.postVote } }, onRelated);
  const { unsubscribe: commentUnsub } = await db.map({ query: { type: TYPE.comment } }, onRelated);

  for (const node of results) {
    if (node.value?.type === TYPE.post) byId.set(node.id, await build(node.value));
  }
  emit();
  return () => { postUnsub?.(); voteUnsub?.(); commentUnsub?.(); };
}
