// Comments + votes. Each comment is an ACL-owned node ({type:'comment', postId,
// parentId?}); each vote is its own signed node, so scores derive from votes. Reads
// derive synchronously from the in-memory store (the app's single db.map). Ported from
// the fork's CommentService.
import { db } from "../db/gdb.js";
import { TYPE, newId, commentVoteId, isAuthenticVote } from "../db/schema.js";
import { select, onChange } from "../db/store.js";
import { activeAddress } from "./identity.js";
import { grantCommunityModerators } from "./moderation.js";

function tally(commentId) {
  let up = 0, down = 0;
  for (const { value } of select((n) => n.type === TYPE.commentVote && n.commentId === commentId)) {
    if (!isAuthenticVote(value)) continue; // ignore votes not signed by the voter
    if (value.direction === "up") up++;
    else if (value.direction === "down") down++;
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
function build(value) {
  return { ...base(value), ...tally(value.id) };
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
 * Subscribe to a post's comments live (oldest first), scores re-derived from the store on
 * any comment/vote change. No db.map of its own (the app shares one). Returns unsub.
 */
export function subscribeComments(postId, onChange_) {
  const emit = () => onChange_(
    select((v) => v.type === TYPE.comment && v.postId === postId)
      .map(({ value }) => build(value))
      .sort((a, b) => a.createdAt - b.createdAt),
  );
  emit();
  return onChange(emit, [TYPE.comment, TYPE.commentVote]);
}
