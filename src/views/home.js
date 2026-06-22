// Home: the live community feed. Subscribes to all communities and re-renders the
// grid on every change. The hero/landing role is covered by the onboarding gate.
import { html, esc } from "../ui/base.js";
import { subscribeCommunities } from "../services/communities.js";
import { plural } from "../utils/format.js";

/** @returns {Promise<HTMLElement>} */
export default async function home() {
  const el = document.createElement("main");
  el.className = "shell";
  el.innerHTML = html`
    <div class="page-head">
      <div>
        <h1 class="page-title">Communities</h1>
        <p class="muted">Public, peer-to-peer spaces. Anyone can create one.</p>
      </div>
      <a class="btn" href="/create-community">New community</a>
    </div>
    <div class="grid" data-list><p class="muted">Loading…</p></div>
  `;

  const list = el.querySelector("[data-list]");
  const renderList = (communities) => {
    list.innerHTML = communities.length
      ? communities.map(card).join("")
      : html`<div class="empty"><p>No communities yet.</p>
          <a class="btn" href="/create-community">Create the first one</a></div>`;
  };

  el._cleanup = await subscribeCommunities(renderList);
  return el;
}

function card(c) {
  const initial = esc((c.displayName || c.name || "?").charAt(0).toUpperCase());
  return html`
    <a class="community-card" href="/c/${esc(c.id)}">
      <div class="avatar">${initial}</div>
      <div class="community-body">
        <h3>${esc(c.displayName)}</h3>
        <p class="muted">${esc(c.description || "No description")}</p>
        <span class="meta">${esc(plural(c.memberCount, "member"))}</span>
      </div>
    </a>
  `;
}
