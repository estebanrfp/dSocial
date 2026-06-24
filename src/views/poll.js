// Poll detail: vote (single or multiple choice; private polls require an invite
// code) or see live results (bars with %, your choice highlighted). The tally is
// derived from signed votes and refreshes after voting.
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { loadPoll, subscribePoll, vote, getMyVote, consumeInviteCode } from "../services/polls.js";
import { timeAgo, plural } from "../utils/format.js";

/** @returns {Promise<HTMLElement>} */
export default async function pollView({ pollId }) {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";

  let poll = await loadPoll(pollId);
  if (!poll) {
    el.innerHTML = html`<a class="back" href="/home">← Home</a><div class="empty"><p>Poll not found.</p></div>`;
    return el;
  }
  let mine = await getMyVote(pollId);
  const selected = new Set();

  const render = () => {
    const showResults = mine.length > 0 || poll.isExpired;
    const max = Math.max(1, ...poll.options.map((o) => o.votes));
    el.innerHTML = html`
      <a class="back" href="/c/${esc(poll.communityId)}">← Back</a>
      <div class="card poll-detail">
        <h1 class="poll-q">${esc(poll.question)}</h1>
        ${poll.description ? html`<p class="muted">${esc(poll.description)}</p>` : ""}
        ${poll.isPrivate && !showResults ? inviteField() : ""}
        <div class="poll-options">
          ${poll.options.map((o) => (showResults ? resultRow(o, poll, mine, max) : choiceRow(o, poll, selected))).join("")}
        </div>
        <div class="poll-meta">
          ${esc(plural(poll.totalVotes, "vote"))} · ${poll.isExpired ? "ended" : "ends " + esc(timeAgo(poll.expiresAt))}
        </div>
        ${showResults ? "" : html`<p class="form-error" data-error hidden></p>
          <div class="row"><button class="btn" data-submit ${selected.size ? "" : "disabled"}>Vote</button></div>`}
      </div>
    `;
    wire(showResults);
  };

  const wire = (showResults) => {
    if (showResults) return;
    el.querySelectorAll("[data-choice]").forEach((row) =>
      row.addEventListener("click", () => {
        const id = row.dataset.choice;
        if (poll.allowMultipleChoices) {
          selected.has(id) ? selected.delete(id) : selected.add(id);
        } else {
          selected.clear();
          selected.add(id);
        }
        render();
      }),
    );
    el.querySelector("[data-submit]")?.addEventListener("click", async () => {
      const err = el.querySelector("[data-error]");
      err.hidden = true;
      try {
        if (poll.isPrivate) {
          const code = el.querySelector("[data-code]")?.value.trim();
          if (!code) { err.textContent = "An invite code is required."; err.hidden = false; return; }
          const ok = await consumeInviteCode(pollId, code);
          if (!ok) { err.textContent = "Invalid or used invite code."; err.hidden = false; return; }
        }
        await vote(pollId, [...selected]);
        poll = await loadPoll(pollId);
        mine = await getMyVote(pollId);
        render();
      } catch (e) {
        err.textContent = e?.message || "Failed to vote.";
        err.hidden = false;
      }
    });
  };

  render();

  // Keep the tally live — re-derived whenever anyone (any peer) votes on this poll.
  // My own vote/selection (mine, selected) is preserved across these re-renders.
  const unsubPoll = await subscribePoll(pollId, (p) => {
    if (!p) return navigate(`/c/${poll.communityId}`); // deleted (by me or a moderator)
    poll = p;
    render();
  });
  el._cleanup = () => unsubPoll?.();
  return el;
}

function choiceRow(o, poll, selected) {
  const on = selected.has(o.id);
  return html`
    <button type="button" class="choice ${on ? "on" : ""}" data-choice="${esc(o.id)}">
      <span class="choice-mark">${on ? "●" : "○"}</span>
      <span>${esc(o.text)}</span>
    </button>`;
}

function resultRow(o, poll, mine, max) {
  const pct = poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
  const isMine = mine.includes(o.id);
  return html`
    <div class="result ${isMine ? "mine" : ""}">
      <div class="result-bar" style="--pct:${(o.votes / max) * 100}%"></div>
      <div class="result-label"><span>${esc(o.text)}${isMine ? " ✓" : ""}</span><span>${pct}% · ${o.votes}</span></div>
    </div>`;
}

function inviteField() {
  return html`<label class="field"><span>Invite code</span>
    <input class="input" data-code placeholder="Enter your code" autocomplete="off" /></label>`;
}
