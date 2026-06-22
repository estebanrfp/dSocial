// Polls + native voting. Each poll is an ACL-owned node; each vote is its own
// signed, deterministically-id'd node (`pollId:voter`), so tallies derive from
// signed votes (one vote per identity, re-voting overwrites). Private polls gate
// voting behind single-use invite codes. Ported from the fork's PollService.
import { db } from "../db/gdb.js";
import { TYPE, newId, voteId, isAuthenticVote } from "../db/schema.js";
import { activeAddress } from "./identity.js";
import { grantCommunityModerators } from "./moderation.js";

const DAY_MS = 86400000;
const randCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);

/** Aggregate a poll's signed vote nodes into per-option tallies. */
async function buildPoll(pollId, record) {
  const { results } = await db.map({ query: { type: TYPE.vote, pollId } });
  const votersByOption = new Map();
  for (const node of results) {
    const v = node.value;
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

/** Whether the active identity has voted on a poll. */
export async function hasVoted(pollId) {
  const voter = activeAddress();
  if (!voter) return false;
  const { result } = await db.get(voteId(pollId, voter));
  return result?.value?.type === TYPE.vote;
}

/** The option ids the active identity voted for, or []. */
export async function getMyVote(pollId) {
  const voter = activeAddress();
  if (!voter) return [];
  const { result } = await db.get(voteId(pollId, voter));
  return result?.value?.type === TYPE.vote ? (result.value.optionIds ?? []) : [];
}

/** Load one poll with its derived tally, or null. */
export async function loadPoll(pollId) {
  const { result } = await db.get(pollId);
  if (result?.value?.type !== TYPE.poll) return null;
  return buildPoll(pollId, result.value);
}

/** Delete a poll (owner or delegated moderator). */
export const deletePoll = (pollId) => db.sm.acls.delete(pollId);

// ── Private-poll invite codes ────────────────────────────────────────────────

/** Unused invite codes for a poll. */
export async function getInviteCodes(pollId) {
  const { results } = await db.map({ query: { type: "inviteCode", pollId } });
  return results.filter((n) => !n.value.usedBy).map((n) => n.value.code);
}

/** Claim a single-use code for the active voter. Returns true if valid/available. */
export async function consumeInviteCode(pollId, code) {
  const voter = activeAddress();
  if (!voter) return false;
  const id = `invite:${pollId}:${code}`;
  const { result } = await db.get(id);
  const node = result?.value;
  if (!node) return false;
  if (node.usedBy && node.usedBy !== voter) return false;
  await db.put({ ...node, usedBy: voter }, id);
  return true;
}

/**
 * Subscribe to a community's polls live, with tallies re-derived when votes
 * change. `onChange(polls[])` newest first. Returns an unsubscribe function.
 */
export async function subscribePolls(communityId, onChange) {
  const byId = new Map();
  const emit = () => onChange([...byId.values()].sort((a, b) => b.createdAt - a.createdAt));
  const refresh = async (id) => {
    const p = await loadPoll(id);
    if (p) byId.set(id, p);
    else byId.delete(id);
    emit();
  };
  const { results, unsubscribe: pollUnsub } = await db.map(
    { query: { type: TYPE.poll, communityId } },
    ({ id, value, action }) => {
      if (action === "removed") { byId.delete(id); emit(); }
      else if (value?.type === TYPE.poll) refresh(id);
    },
  );
  const onVote = ({ value }) => {
    const pid = value?.pollId;
    if (pid && byId.has(pid)) refresh(pid);
  };
  const { unsubscribe: voteUnsub } = await db.map({ query: { type: TYPE.vote } }, onVote);

  for (const node of results) {
    if (node.value?.type === TYPE.poll) byId.set(node.id, await buildPoll(node.id, node.value));
  }
  emit();
  return () => { pollUnsub?.(); voteUnsub?.(); };
}
