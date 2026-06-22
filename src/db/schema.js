// The graph shape: node `type` values and id schemes. Single source of truth so
// services and queries never hard-code strings.

/** Node type tags. */
export const TYPE = Object.freeze({
  user: "user",
  community: "community",
  membership: "membership",
  post: "post",
  postVote: "postVote",
  comment: "comment",
  commentVote: "commentVote",
  poll: "poll",
  vote: "vote",
  image: "image",
  dm: "dm",
  chatRoom: "chatRoom",
  chatMessage: "chatMessage",
  roomMember: "roomMember",
});

const rand = () => Math.random().toString(36).slice(2, 11);

/** Random, time-ordered id for content nodes: `post-1718...-ab12cd34`. */
export const newId = (prefix) => `${prefix}-${Date.now()}-${rand()}`;

/** Slug → deterministic community id: `c-my-community`. */
export const communityId = (name) =>
  "c-" +
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

// Deterministic ids = one node per (entity, identity) → idempotent + ACL-owned.
export const membershipId = (cid, addr) => `member:${cid}:${addr}`;
export const voteId = (pollId, voter) => `${pollId}:${voter}`;
export const postVoteId = (postId, voter) => `postVote:${postId}:${voter}`;
export const commentVoteId = (commentId, voter) => `commentVote:${commentId}:${voter}`;
export const roomMemberId = (roomId, addr) => `roomMember:${roomId}:${addr}`;

/**
 * A vote counts toward a tally only when its cryptographically-verified signer
 * (`owner`, set by the Security Manager and propagated to every peer) matches the
 * `voter` it claims to be. Without this, anyone could inflate a score or their own
 * karma by signing votes under fake voter ids. The check makes every tally
 * trustless and independently auditable by any peer.
 */
export const isAuthenticVote = (v) => !!v && v.owner != null && v.owner === v.voter;
