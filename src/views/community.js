// Community detail: header + join/new-post action + the live post feed (scores
// derived from signed votes, re-rendered on change).
import { html, esc } from "../ui/base.js";
import { getCommunity, isMember, joinCommunity } from "../services/communities.js";
import { subscribePosts, voteOnPost } from "../services/posts.js";
import { stripMarkdown } from "../utils/markdown.js";
import { timeAgo, plural } from "../utils/format.js";
import { abbr } from "../state/session.js";

/** @returns {Promise<HTMLElement>} */
export default async function community({ communityId }) {
  const el = document.createElement("main");
  el.className = "shell";

  const c = await getCommunity(communityId);
  if (!c) {
    el.innerHTML = html`<a class="back" href="/home">← Communities</a>
      <div class="empty"><p>Community not found.</p></div>`;
    return el;
  }

  const member = await isMember(communityId);
  el.innerHTML = html`
    <a class="back" href="/home">← Communities</a>
    <header class="detail-head">
      <div class="avatar lg">${esc((c.displayName || "?").charAt(0).toUpperCase())}</div>
      <div class="detail-head-body">
        <h1 class="page-title">${esc(c.displayName)}</h1>
        <p class="muted">${esc(c.description || "No description")}</p>
        <span class="meta">${esc(plural(c.memberCount, "member"))}</span>
      </div>
      <div class="detail-actions" data-actions></div>
    </header>
    <div class="grid" data-posts><p class="muted">Loading posts…</p></div>
  `;

  const actions = el.querySelector("[data-actions]");
  const renderActions = (isMemberNow) => {
    actions.innerHTML = isMemberNow
      ? html`<a class="btn" href="/c/${esc(communityId)}/new-post">New post</a>`
      : html`<button class="btn btn-ghost" data-join>Join</button>`;
    actions.querySelector("[data-join]")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      await joinCommunity(communityId);
      renderActions(true);
    });
  };
  renderActions(member);

  const postsEl = el.querySelector("[data-posts]");
  const renderPosts = (posts) => {
    if (!posts.length) {
      postsEl.innerHTML = html`<div class="empty"><p>No posts yet.</p></div>`;
      return;
    }
    postsEl.innerHTML = posts.map(postCard).join("");
    postsEl.querySelectorAll("[data-vote]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { await voteOnPost(btn.dataset.post, btn.dataset.vote); } catch (err) { console.error(err); }
      }),
    );
  };

  el._cleanup = await subscribePosts(communityId, renderPosts);
  return el;
}

function postCard(p) {
  const snippet = stripMarkdown(p.content).slice(0, 160);
  return html`
    <a class="post-card" href="/p/${esc(p.id)}">
      <div class="post-votes" onclick="event.preventDefault()">
        <button class="vote" data-vote="up" data-post="${esc(p.id)}" aria-label="Upvote">▲</button>
        <span class="score">${p.score}</span>
        <button class="vote" data-vote="down" data-post="${esc(p.id)}" aria-label="Downvote">▼</button>
      </div>
      <div class="post-body">
        <h3>${esc(p.title)}</h3>
        ${snippet ? html`<p class="muted">${esc(snippet)}</p>` : ""}
        <span class="meta">${esc(abbr(p.authorId))} · ${esc(timeAgo(p.createdAt))} · ${esc(plural(p.commentCount, "comment"))}</span>
      </div>
    </a>
  `;
}
