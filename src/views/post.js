// Post detail: rendered Markdown body + vote, and a live comment thread (each
// comment votable; scores derive from signed votes).
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { getPost, voteOnPost, deletePost } from "../services/posts.js";
import { subscribeComments, createComment, voteOnComment } from "../services/comments.js";
import { renderMarkdown } from "../utils/markdown.js";
import { timeAgo } from "../utils/format.js";
import { abbr } from "../state/session.js";
import { activeAddress, getKarma } from "../services/identity.js";
import { getImage } from "../services/images.js";
import { badgeChip } from "../services/badges.js";

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
          <span class="meta">${badgeChip(authorKarma)} ${esc(abbr(post.authorId))} · ${esc(timeAgo(post.createdAt))}${post.editedAt ? " · edited" : ""}</span>
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
      try {
        await voteOnPost(postId, b.dataset.pvote);
        const p = await getPost(postId);
        el.querySelector("[data-score]").textContent = p.score;
      } catch (e) { console.error(e); }
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

  el._cleanup = await subscribeComments(postId, renderComments);
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
        <span class="meta">${esc(abbr(c.authorId))} · ${esc(timeAgo(c.createdAt))}</span>
      </div>
    </div>`;
}
