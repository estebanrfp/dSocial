// Post detail: rendered Markdown body + vote, and a live comment thread (each
// comment votable; scores derive from signed votes).
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { getPost, subscribePost, voteOnPost, deletePost } from "../services/posts.js";
import { subscribeComments, createComment, voteOnComment } from "../services/comments.js";
import { renderMarkdown } from "../utils/markdown.js";
import { timeAgo } from "../utils/format.js";
import { abbr } from "../state/session.js";
import { displayNameFor } from "../services/names.js";
import { activeAddress, getKarma } from "../services/identity.js";
import { getImage } from "../services/images.js";
import { badgeChip } from "../services/badges.js";
import { setViewing, viewersOf, onPresence } from "../services/presence.js";

/** @returns {Promise<HTMLElement>} */
export default async function postView({ postId }) {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";

  const post = await getPost(postId);
  if (!post) {
    el.innerHTML = html`<a class="back" href="/home">← Home</a><div class="empty"><p>Post not found.</p></div>`;
    return el;
  }

  const me = activeAddress();
  const mine = !!me && me.toLowerCase() === String(post.authorId).toLowerCase();
  const authorKarma = await getKarma(post.authorId);

  el.innerHTML = html`
    <a class="back" href="/c/${esc(post.communityId)}">← Back</a>
    <article class="card post-detail">
      <div class="post-votes">
        <button class="vote" data-pvote="up" aria-label="Upvote">▲</button>
        <span class="score" data-score>${post.score}</span>
        <button class="vote" data-pvote="down" aria-label="Downvote">▼</button>
      </div>
      <div class="post-detail-body">
        <h1 class="post-title">${esc(post.title)}</h1>
        <div class="markdown">${renderMarkdown(post.content)}</div>
        ${post.imageId ? html`<img class="post-image" data-postimg alt="Post image" />` : ""}
        <div class="post-meta-row">
          <span class="meta">${badgeChip(authorKarma)} ${esc(displayNameFor(post.authorId))} <span class="addr">${esc(abbr(post.authorId))}</span> · ${esc(timeAgo(post.createdAt))}${post.editedAt ? " · edited" : ""} · <span class="sig">✓ signed</span></span>
          ${
            mine
              ? html`<div class="post-actions">
                  <a class="btn btn-ghost btn-sm" href="/p/${esc(postId)}/edit">Edit</a>
                  <button class="btn btn-ghost btn-sm" data-del-post>Delete</button>
                </div>`
              : ""
          }
        </div>
      </div>
    </article>

    <div class="viewing-now" data-viewing hidden></div>

    <h2 class="section-title">Comments</h2>
    <form class="comment-form" data-form>
      <textarea class="input" name="content" rows="2" placeholder="Add a comment…"></textarea>
      <div class="row"><button class="btn btn-sm" type="submit">Comment</button></div>
    </form>
    <div class="comments" data-comments><p class="muted">Loading…</p></div>
  `;

  if (post.imageId) {
    getImage(post.imageId).then((data) => {
      const img = el.querySelector("[data-postimg]");
      if (data && img) img.src = data;
      else img?.remove();
    });
  }

  if (mine) {
    el.querySelector("[data-del-post]")?.addEventListener("click", async () => {
      if (!window.confirm("Delete your post?")) return;
      try {
        await deletePost(postId);
        navigate(`/c/${post.communityId}`);
      } catch (e) {
        alert("Delete denied: " + e.message);
      }
    });
  }

  el.querySelectorAll("[data-pvote]").forEach((b) =>
    b.addEventListener("click", async () => {
      // The score updates reactively via subscribePost (below) — no manual re-read.
      try { await voteOnPost(postId, b.dataset.pvote); } catch (e) { console.error(e); }
    }),
  );

  const form = el.querySelector("[data-form]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = form.content.value.trim();
    if (!content) return;
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      await createComment({ postId, communityId: post.communityId, content });
      form.content.value = "";
    } catch (err) { console.error(err); }
    btn.disabled = false;
  });

  const commentsEl = el.querySelector("[data-comments]");
  const renderComments = (comments) => {
    commentsEl.innerHTML = comments.length
      ? comments.map(commentCard).join("")
      : `<p class="muted">No comments yet. Be the first.</p>`;
    commentsEl.querySelectorAll("[data-cvote]").forEach((b) =>
      b.addEventListener("click", async () => {
        try { await voteOnComment(b.dataset.comment, b.dataset.cvote); } catch (e) { console.error(e); }
      }),
    );
  };

  // Live "viewing now": announce I'm on this post; show other peers viewing it.
  const viewingEl = el.querySelector("[data-viewing]");
  const renderViewers = () => {
    const addrs = viewersOf(postId);
    if (!addrs.length) { viewingEl.hidden = true; return; }
    viewingEl.hidden = false;
    const names = addrs.slice(0, 3).map(displayNameFor);
    const extra = addrs.length - names.length;
    const who = names.join(", ") + (extra > 0 ? ` +${extra}` : "");
    viewingEl.innerHTML = `<span class="viewing-dot"></span>${esc(who)} viewing now`;
  };

  // Keep the post's vote score live — re-derived whenever anyone (any peer) votes.
  const scoreEl = el.querySelector("[data-score]");
  const unsubPost = await subscribePost(postId, (p) => {
    if (!p) return navigate(`/c/${post.communityId}`); // deleted (by me or a moderator)
    if (scoreEl) scoreEl.textContent = p.score;
  });
  const unsubComments = await subscribeComments(postId, renderComments);
  setViewing(postId);
  const unsubPresence = onPresence(renderViewers);
  renderViewers();
  el._cleanup = () => {
    unsubPost?.();
    unsubComments?.();
    unsubPresence?.();
    setViewing(null); // tell peers I've left this post
  };
  return el;
}

function commentCard(c) {
  return html`
    <div class="comment">
      <div class="post-votes sm">
        <button class="vote" data-cvote="up" data-comment="${esc(c.id)}" aria-label="Upvote">▲</button>
        <span class="score">${c.score}</span>
        <button class="vote" data-cvote="down" data-comment="${esc(c.id)}" aria-label="Downvote">▼</button>
      </div>
      <div class="comment-body">
        <p>${esc(c.content)}</p>
        <span class="meta">${esc(displayNameFor(c.authorId))} · ${esc(timeAgo(c.createdAt))}</span>
      </div>
    </div>`;
}
