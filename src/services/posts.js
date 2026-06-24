// Posts + up/down votes. Each post is an ACL-owned node (author = owner); each vote is a
// deterministic, ACL-owned node so scores derive from signed votes (no mutable counter to
// corrupt). Reads derive synchronously from the in-memory store (the app's single db.map)
// — no per-call db.map. Ported from the fork's PostService.
import { db } from "../db/gdb.js";
import { TYPE, newId, postVoteId, isAuthenticVote } from "../db/schema.js";
import { select, value as nodeOf, onChange } from "../db/store.js";
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

/** Build a post's UI shape (score + comment count) from the in-memory graph (sync).
 *  Only votes whose verified signer matches the voter count (no forged voters). */
function build(value) {
  const votes = select((n) => n.type === TYPE.postVote && n.postId === value.id)
    .map((n) => n.value)
    .filter(isAuthenticVote)
    .map((v) => ({ voter: v.voter, direction: v.direction }));
  const commentCount = select((n) => n.type === TYPE.comment && n.postId === value.id).length;
  return { ...base(value), ...tally(votes), commentCount };
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
  const v = nodeOf(postId);
  if (v?.type !== TYPE.post) throw new Error("Post not found");
  const next = { ...v, title: title ?? v.title, content: content ?? "", editedAt: Date.now() };
  if (imageId !== undefined) next.imageId = imageId;
  await db.sm.acls.set(next, postId);
  return base(next);
}

/** Read one post with derived score + comment count, or null (sync, from the store). */
export function getPost(postId) {
  const v = nodeOf(postId);
  return v?.type === TYPE.post ? build(v) : null;
}

/**
 * Delete a post (owner or delegated moderator, enforced by ACLs). When the author
 * deletes their own post, re-derive their postCount so dropping below the threshold
 * demotes trusted→member (only the owner can write their own user node).
 */
export async function deletePost(postId) {
  const me = activeAddress();
  const authorId = nodeOf(postId)?.authorId;
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

/** The active identity's vote direction on a post ('up'|'down'|null) (sync). */
export function myPostVote(postId) {
  const voter = activeAddress();
  if (!voter) return null;
  const v = nodeOf(postVoteId(postId, voter));
  return v?.type === TYPE.postVote ? v.direction : null;
}

/**
 * Subscribe to a community's posts live (newest first). Scores/comment counts are
 * re-derived from the in-memory store on any post/vote/comment change — no db.map of its
 * own (the app shares one). `onChange(posts[])`. Returns an unsubscribe.
 */
export function subscribePosts(communityId, onChange_) {
  const emit = () => onChange_(
    select((v) => v.type === TYPE.post && v.communityId === communityId)
      .map(({ value }) => build(value))
      .sort((a, b) => b.createdAt - a.createdAt),
  );
  emit(); // initial — the data is already local
  return onChange(emit, [TYPE.post, TYPE.postVote, TYPE.comment]);
}

/** Subscribe to ONE post live (the detail view). `onChange(post|null)` — null once the
 *  post is deleted. Returns an unsubscribe. */
export function subscribePost(postId, onChange_) {
  const emit = () => onChange_(getPost(postId));
  emit();
  return onChange(emit, [TYPE.post, TYPE.postVote, TYPE.comment]);
}
