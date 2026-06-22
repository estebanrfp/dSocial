// Comments + votes. Each comment is an ACL-owned node ({type:'comment', postId,
// parentId?}); each vote is its own signed node, so scores derive from votes.
// Ported from the fork's CommentService.
import { db } from "../db/gdb.js";
import { TYPE, newId, commentVoteId, isAuthenticVote } from "../db/schema.js";
import { activeAddress } from "./identity.js";
import { grantCommunityModerators } from "./moderation.js";

async function tally(commentId) {
  const { results } = await db.map({ query: { type: TYPE.commentVote, commentId } });
  let up = 0, down = 0;
  for (const n of results) {
    if (!isAuthenticVote(n.value)) continue; // ignore votes not signed by the voter
    if (n.value.direction === "up") up++;
    else if (n.value.direction === "down") down++;
  }
  return { upvotes: up, downvotes: down, score: up - down };
}

function base(value) {
  return {
    id: value.id,
    postId: value.postId,
    communityId: value.communityId,
    authorId: value.authorId,
    content: value.content || "",
    parentId: value.parentId || "",
    createdAt: value.createdAt ?? 0,
  };
}
async function build(value) {
  return { ...base(value), ...(await tally(value.id)) };
}

/** Create a comment (author = ACL owner; grants moderators delete). */
export async function createComment({ postId, communityId, content, parentId }) {
  const me = activeAddress();
  if (!me) throw new Error("No active identity");
  const id = newId("comment");
  const record = {
    type: TYPE.comment, id, postId, communityId, authorId: me,
    content, parentId: parentId || "", createdAt: Date.now(),
  };
  await db.sm.acls.set(record, id);
  await grantCommunityModerators(id, communityId);
  return { ...base(record), upvotes: 0, downvotes: 0, score: 0 };
}

/** Cast/change a vote on a comment. */
export async function voteOnComment(commentId, direction) {
  const voter = activeAddress();
  if (!voter) throw new Error("No active identity");
  await db.sm.acls.set(
    { type: TYPE.commentVote, commentId, voter, direction, createdAt: Date.now() },
    commentVoteId(commentId, voter),
  );
}

/** Delete a comment (owner or delegated moderator). */
export const deleteComment = (commentId) => db.sm.acls.delete(commentId);

/**
 * Subscribe to a post's comments live, with scores re-derived when votes change.
 * `onChange(comments[])` oldest first. Returns an unsubscribe function.
 */
export async function subscribeComments(postId, onChange) {
  const byId = new Map();
  const emit = () => onChange([...byId.values()].sort((a, b) => a.createdAt - b.createdAt));
  const refresh = async (id) => {
    const { result } = await db.get(id);
    if (result?.value?.type === TYPE.comment) byId.set(id, await build(result.value));
    else byId.delete(id);
    emit();
  };
  const { results, unsubscribe: cUnsub } = await db.map(
    { query: { type: TYPE.comment, postId } },
    ({ id, value, action }) => {
      if (action === "removed") { byId.delete(id); emit(); }
      else if (value?.type === TYPE.comment) refresh(id);
    },
  );
  const onVote = ({ value }) => {
    const cid = value?.commentId;
    if (cid && byId.has(cid)) refresh(cid);
  };
  const { unsubscribe: vUnsub } = await db.map({ query: { type: TYPE.commentVote } }, onVote);

  for (const node of results) {
    if (node.value?.type === TYPE.comment) byId.set(node.id, await build(node.value));
  }
  emit();
  return () => { cUnsub?.(); vUnsub?.(); };
}
