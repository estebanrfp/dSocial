// Polls + native voting. Each poll is an ACL-owned node; each vote is its own signed,
// deterministically-id'd node (`pollId:voter`), so tallies derive from signed votes (one
// vote per identity, re-voting overwrites). Private polls gate voting behind single-use
// invite codes. Reads derive synchronously from the in-memory store (the app's single
// db.map). Ported from the fork's PollService.
import { db } from "../db/gdb.js";
import { TYPE, newId, voteId, isAuthenticVote } from "../db/schema.js";
import { select, value as nodeOf, onChange } from "../db/store.js";
import { activeAddress } from "./identity.js";
import { grantCommunityModerators } from "./moderation.js";

const DAY_MS = 86400000;
const randCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);

/** Aggregate a poll's signed vote nodes into per-option tallies (sync, from the store). */
function buildPoll(pollId, record) {
  const votersByOption = new Map();
  for (const { value: v } of select((n) => n.type === TYPE.vote && n.pollId === pollId)) {
    if (!isAuthenticVote(v) || !Array.isArray(v.optionIds)) continue; // signer must match voter
    for (const optId of v.optionIds) {
      const arr = votersByOption.get(optId) ?? [];
      if (!arr.includes(v.voter)) arr.push(v.voter);
      votersByOption.set(optId, arr);
    }
  }
  const options = (record.options ?? []).map((o) => {
    const voters = (votersByOption.get(o.id) ?? []).sort();
    return { id: o.id, text: o.text, votes: voters.length, voters };
  });
  const totalVotes = options.reduce((s, o) => s + o.votes, 0);
  return { ...record, id: pollId, options, totalVotes, isExpired: Date.now() > (record.expiresAt ?? 0) };
}

/** Create a poll (author = ACL owner). Optionally private with single-use codes. */
export async function createPoll({
  communityId, question, description, options,
  durationDays = 7, allowMultipleChoices = false, isPrivate = false, inviteCodeCount = 0,
}) {
  const me = activeAddress();
  if (!me) throw new Error("No active identity");
  const id = newId("poll");
  const now = Date.now();
  const record = {
    type: TYPE.poll, communityId, authorId: me, question, description: description ?? "",
    options: options.map((text, idx) => ({ id: `${id}-option-${idx}`, text })),
    createdAt: now, expiresAt: now + (durationDays || 7) * DAY_MS,
    allowMultipleChoices: !!allowMultipleChoices, showResultsBeforeVoting: false,
    requireLogin: false, isPrivate: !!isPrivate,
  };
  await db.sm.acls.set(record, id);
  await grantCommunityModerators(id, communityId);

  if (isPrivate && inviteCodeCount) {
    await Promise.all(
      Array.from({ length: inviteCodeCount }, () => {
        const code = randCode();
        return db.put({ type: "inviteCode", pollId: id, code, usedBy: null }, `invite:${id}:${code}`);
      }),
    );
  }
  return buildPoll(id, record);
}

/** Cast/change a vote (the voter is the active identity; one node per identity). */
export async function vote(pollId, optionIds) {
  const voter = activeAddress();
  if (!voter) throw new Error("No active identity");
  await db.sm.acls.set(
    { type: TYPE.vote, pollId, optionIds, voter, createdAt: Date.now() },
    voteId(pollId, voter),
  );
}

/** Whether the active identity has voted on a poll (sync). */
export function hasVoted(pollId) {
  const voter = activeAddress();
  if (!voter) return false;
  return nodeOf(voteId(pollId, voter))?.type === TYPE.vote;
}

/** The option ids the active identity voted for, or [] (sync). */
export function getMyVote(pollId) {
  const voter = activeAddress();
  if (!voter) return [];
  const v = nodeOf(voteId(pollId, voter));
  return v?.type === TYPE.vote ? (v.optionIds ?? []) : [];
}

/** Load one poll with its derived tally, or null (sync, from the store). */
export function loadPoll(pollId) {
  const v = nodeOf(pollId);
  return v?.type === TYPE.poll ? buildPoll(pollId, v) : null;
}

/** Delete a poll (owner or delegated moderator). */
export const deletePoll = (pollId) => db.sm.acls.delete(pollId);

// ── Private-poll invite codes ────────────────────────────────────────────────

/** Unused invite codes for a poll (sync). */
export function getInviteCodes(pollId) {
  return select((v) => v.type === "inviteCode" && v.pollId === pollId && !v.usedBy).map((x) => x.value.code);
}

/** Claim a single-use code for the active voter. Returns true if valid/available. */
export async function consumeInviteCode(pollId, code) {
  const voter = activeAddress();
  if (!voter) return false;
  const id = `invite:${pollId}:${code}`;
  const node = nodeOf(id);
  if (!node) return false;
  if (node.usedBy && node.usedBy !== voter) return false;
  await db.put({ ...node, usedBy: voter }, id);
  return true;
}

/** Subscribe to a community's polls live (newest first). Tallies re-derive from the store
 *  on any poll/vote change. No db.map of its own. Returns an unsubscribe. */
export function subscribePolls(communityId, onChange_) {
  const emit = () => onChange_(
    select((v) => v.type === TYPE.poll && v.communityId === communityId)
      .map(({ id, value }) => buildPoll(id, value))
      .sort((a, b) => b.createdAt - a.createdAt),
  );
  emit();
  return onChange(emit, [TYPE.poll, TYPE.vote]);
}

/** Subscribe to ONE poll live (the detail view). onChange(poll|null). Returns unsub. */
export function subscribePoll(pollId, onChange_) {
  const emit = () => onChange_(loadPoll(pollId));
  emit();
  return onChange(emit, [TYPE.poll, TYPE.vote]);
}
