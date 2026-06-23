// Community detail: header + join/new-post/new-poll actions + a live feed mixing
// posts and polls (newest first). Scores/tallies derive from signed votes.
import { html, esc } from "../ui/base.js";
import { getCommunity, isMember, joinCommunity, addModerator, removeModerator } from "../services/communities.js";
import { loadPostsPage, watchPostUpdates, getPost, voteOnPost, deletePost } from "../services/posts.js";
import { subscribePolls } from "../services/polls.js";
import { stripMarkdown } from "../utils/markdown.js";
import { timeAgo, plural } from "../utils/format.js";
import { abbr } from "../state/session.js";
import { displayNameFor, onNameChange } from "../services/names.js";
import { activeAddress } from "../services/identity.js";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const sameAddr = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

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
  const me = activeAddress();
  const owner = c.owner || c.creatorId;
  const isOwner = sameAddr(me, owner);
  let mods = c.moderators.slice();
  const canModerate = () => isOwner || mods.some((m) => sameAddr(m, me));

  el.innerHTML = html`
    <a class="back" href="/home">← Communities</a>
    <header class="detail-head">
      <div class="avatar lg">${esc((c.displayName || "?").charAt(0).toUpperCase())}</div>
      <div class="detail-head-body">
        <h1 class="page-title">${esc(c.displayName)}</h1>
        <p class="muted">${esc(c.description || "No description")}</p>
        <span class="meta">${esc(plural(c.memberCount, "member"))}${mods.length ? ` · ${esc(plural(mods.length, "moderator"))}` : ""}</span>
      </div>
      <div class="detail-actions" data-actions></div>
    </header>
    ${isOwner ? html`<section class="mod-panel" data-modpanel></section>` : ""}
    <div class="grid" data-feed><p class="muted">Loading…</p></div>
  `;

  if (isOwner) {
    const panel = el.querySelector("[data-modpanel]");
    const renderMods = () => {
      panel.innerHTML = html`
        <h2 class="mod-title">Moderators <span class="muted small">— they can delete posts in this community</span></h2>
        <form class="mod-add" data-modadd>
          <input class="input" name="addr" placeholder="Moderator address (0x…)" autocomplete="off" spellcheck="false" />
          <button class="btn btn-primary btn-sm" type="submit">Add</button>
        </form>
        <ul class="mod-list">
          ${mods.length
            ? mods.map((m) => html`<li><span class="mono">${esc(abbr(m))}</span><button class="btn btn-ghost btn-sm" data-rmmod="${esc(m)}">Remove</button></li>`).join("")
            : html`<li class="muted small">No moderators yet.</li>`}
        </ul>`;
      panel.querySelector("[data-modadd]").addEventListener("submit", async (e) => {
        e.preventDefault();
        const addr = e.target.elements.addr.value.trim();
        if (!ADDR_RE.test(addr)) return alert("Enter a valid 0x… address.");
        if (mods.some((m) => sameAddr(m, addr))) return alert("Already a moderator.");
        await addModerator(communityId, addr);
        mods = [...mods, addr];
        renderMods();
      });
      panel.querySelectorAll("[data-rmmod]").forEach((b) =>
        b.addEventListener("click", async () => {
          await removeModerator(communityId, b.dataset.rmmod);
          mods = mods.filter((m) => !sameAddr(m, b.dataset.rmmod));
          renderMods();
        }),
      );
    };
    renderMods();
  }

  const actions = el.querySelector("[data-actions]");
  const renderActions = (isMemberNow) => {
    actions.innerHTML = isMemberNow
      ? html`<a class="btn btn-ghost btn-sm" href="/c/${esc(communityId)}/new-poll">New poll</a>
             <a class="btn btn-sm" href="/c/${esc(communityId)}/new-post">New post</a>`
      : html`<button class="btn btn-ghost" data-join>Join</button>`;
    actions.querySelector("[data-join]")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      await joinCommunity(communityId);
      renderActions(true);
    });
  };
  renderActions(member);

  const feed = el.querySelector("[data-feed]");
  const postMap = new Map(); // id -> post: cursor-paginated, kept live in place
  let polls = [];
  let cursor = null;
  let feedDone = false;
  let loadingMore = false;

  const renderFeed = () => {
    const items = [
      ...polls.map((p) => ({ kind: "poll", createdAt: p.createdAt, data: p })),
      ...[...postMap.values()].map((p) => ({ kind: "post", createdAt: p.createdAt, data: p })),
    ].sort((a, b) => b.createdAt - a.createdAt);

    if (!items.length && feedDone) { feed.innerHTML = html`<div class="empty"><p>Nothing here yet.</p></div>`; return; }
    const mod = canModerate();
    feed.innerHTML =
      items.map((it) => (it.kind === "poll" ? pollCard(it.data) : postCard(it.data, mod, me))).join("") +
      (feedDone ? "" : html`<div class="feed-more" data-sentinel aria-hidden="true"><span class="spinner"></span></div>`);
    feed.querySelectorAll("[data-vote]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { await voteOnPost(btn.dataset.post, btn.dataset.vote); } catch (err) { console.error(err); }
      }),
    );
    feed.querySelectorAll("[data-del-post]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(btn.dataset.mine ? "Delete your post?" : "Delete this post as a moderator?")) return;
        try { await deletePost(btn.dataset.delPost); } catch (err) { alert("Delete denied: " + err.message); }
      }),
    );
    const sentinel = feed.querySelector("[data-sentinel]");
    if (sentinel) io.observe(sentinel);
  };

  // Cursor pagination: pull one page at a time as the sentinel scrolls into view —
  // never loads the whole community at once.
  const loadMore = async () => {
    if (feedDone || loadingMore) return;
    loadingMore = true;
    try {
      const { posts: page, nextCursor } = await loadPostsPage(communityId, cursor);
      for (const p of page) postMap.set(p.id, p);
      cursor = nextCursor;
      if (!nextCursor) feedDone = true;
    } catch (err) {
      console.error("Feed pagination failed:", err);
      feedDone = true;
    }
    if (feedDone) io.disconnect(); // no more pages — stop observing
    loadingMore = false;
    renderFeed();
  };
  const io = new IntersectionObserver(
    (entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); },
    { rootMargin: "400px" },
  );

  // Keep loaded posts live (scores), AND surface brand-new posts from peers in real time
  // (this live-new path was lost when pagination replaced subscribePosts — the "feed
  // doesn't sync" regression). `since` = mount time so the initial set isn't re-added.
  const mountedAt = Date.now();
  const rescore = async (pid) => {
    if (!postMap.has(pid)) return;
    const fresh = await getPost(pid);
    if (fresh) postMap.set(pid, fresh);
    else postMap.delete(pid);
    renderFeed();
  };
  const addNew = async (pid) => {
    if (postMap.has(pid)) return;
    const fresh = await getPost(pid);
    if (fresh) { postMap.set(pid, fresh); renderFeed(); }
  };

  const unsubWatch = await watchPostUpdates(communityId, { onScore: rescore, onNew: addNew, since: mountedAt });
  const unsubPolls = await subscribePolls(communityId, (p) => { polls = p; renderFeed(); });
  const unsubNames = onNameChange(() => renderFeed()); // a profile got named → refresh bylines
  await loadMore(); // first page
  el._cleanup = () => { io.disconnect(); unsubWatch?.(); unsubPolls?.(); unsubNames?.(); };
  return el;
}

function pollCard(p) {
  return html`
    <a class="post-card poll-card" href="/poll/${esc(p.id)}">
      <span class="kind-tag">Poll</span>
      <div class="post-body">
        <h3>${esc(p.question)}</h3>
        <span class="meta">${esc(plural(p.totalVotes, "vote"))} · ${esc(plural(p.options.length, "option"))}${p.isPrivate ? " · private" : ""} · ${esc(timeAgo(p.createdAt))}</span>
      </div>
    </a>`;
}

function postCard(p, canMod, me) {
  const snippet = stripMarkdown(p.content).slice(0, 160);
  const mine = sameAddr(me, p.authorId);
  const canDelete = mine || canMod; // the author owns their post; moderators can also remove it
  // The delete control is a sibling of the link (a <button> inside an <a> is
  // invalid HTML and swallows clicks), positioned over the card via CSS.
  return html`
    <div class="post-card-wrap">
      <a class="post-card" href="/p/${esc(p.id)}">
        <div class="post-votes">
          <button class="vote" data-vote="up" data-post="${esc(p.id)}" aria-label="Upvote">▲</button>
          <span class="score">${p.score}</span>
          <button class="vote" data-vote="down" data-post="${esc(p.id)}" aria-label="Downvote">▼</button>
        </div>
        <div class="post-body">
          <h3>${esc(p.title)}</h3>
          ${snippet ? html`<p class="muted">${esc(snippet)}</p>` : ""}
          <span class="meta">${esc(displayNameFor(p.authorId))} · ${esc(timeAgo(p.createdAt))} · ${esc(plural(p.commentCount, "comment"))}</span>
        </div>
      </a>
      ${canDelete ? html`<button class="icon-btn post-del" data-del-post="${esc(p.id)}" data-mine="${mine ? "1" : ""}" title="${mine ? "Delete your post" : "Delete (moderator)"}" aria-label="Delete post">🗑</button>` : ""}
    </div>`;
}
