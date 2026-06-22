// Post detail: rendered Markdown body + vote, and a live comment thread (each
// comment votable; scores derive from signed votes).
import { html, esc } from "../ui/base.js";
import { getPost, voteOnPost } from "../services/posts.js";
import { subscribeComments, createComment, voteOnComment } from "../services/comments.js";
import { renderMarkdown } from "../utils/markdown.js";
import { timeAgo } from "../utils/format.js";
import { abbr } from "../state/session.js";

/** @returns {Promise<HTMLElement>} */
export default async function postView({ postId }) {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";

  const post = await getPost(postId);
  if (!post) {
    el.innerHTML = html`<a class="back" href="/home">← Home</a><div class="empty"><p>Post not found.</p></div>`;
    return el;
  }

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
        <span class="meta">${esc(abbr(post.authorId))} · ${esc(timeAgo(post.createdAt))}</span>
      </div>
    </article>

    <h2 class="section-title">Comments</h2>
    <form class="comment-form" data-form>
      <textarea class="input" name="content" rows="2" placeholder="Add a comment…"></textarea>
      <div class="row"><button class="btn btn-sm" type="submit">Comment</button></div>
    </form>
    <div class="comments" data-comments><p class="muted">Loading…</p></div>
  `;

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
