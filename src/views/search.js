// Search: a debounced field-level $text query across communities, posts and
// people, grouped by type. Each result links to its page.
import { html, esc } from "../ui/base.js";
import { searchAll } from "../services/search.js";
import { abbr } from "../state/session.js";
import { stripMarkdown } from "../utils/markdown.js";
import { timeAgo } from "../utils/format.js";

const group = (title, items) =>
  items.length ? `<section class="result-group"><h2>${title} <span class="muted small">${items.length}</span></h2>${items.join("")}</section>` : "";

export default async () => {
  const el = document.createElement("main");
  el.className = "shell search-page";
  el.innerHTML = html`
    <h1 class="page-title">Search</h1>
    <input class="input search-input" data-q placeholder="Search communities, posts, people…" autocomplete="off" spellcheck="false" />
    <div class="search-results" data-results><p class="muted">Type at least 2 characters.</p></div>`;

  const input = el.querySelector("[data-q]");
  const box = el.querySelector("[data-results]");
  let timer = null;
  let token = 0;

  const render = ({ communities, posts, users }) => {
    if (!communities.length && !posts.length && !users.length) {
      box.innerHTML = html`<p class="muted">No matches.</p>`;
      return;
    }
    box.innerHTML = [
      group(
        "Communities",
        communities.map(
          (c) =>
            `<a class="result" href="/c/${esc(c.id)}"><span class="avatar sm">${esc((c.displayName || c.name || "?").charAt(0).toUpperCase())}</span><div class="result-body"><strong>${esc(c.displayName || c.name)}</strong><span class="muted small">${esc(c.description || "")}</span></div></a>`,
        ),
      ),
      group(
        "Posts",
        posts.map(
          (p) =>
            `<a class="result" href="/p/${esc(p.id)}"><div class="result-body"><strong>${esc(p.title)}</strong><span class="muted small">${esc(stripMarkdown(p.content || "").slice(0, 90))} · ${esc(timeAgo(p.createdAt))}</span></div></a>`,
        ),
      ),
      group(
        "People",
        users.map(
          (u) =>
            `<a class="result" href="/u/${esc(u.address)}"><span class="avatar sm">${esc((u.displayName || "?").charAt(0).toUpperCase())}</span><div class="result-body"><strong>${esc(u.displayName || abbr(u.address))}</strong><span class="muted small mono">${esc(abbr(u.address))}</span></div></a>`,
        ),
      ),
    ]
      .filter(Boolean)
      .join("");
  };

  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      box.innerHTML = html`<p class="muted">Type at least 2 characters.</p>`;
      return;
    }
    const mine = ++token;
    box.innerHTML = html`<p class="muted">Searching…</p>`;
    const res = await searchAll(q);
    if (mine === token) render(res);
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  el._cleanup = () => clearTimeout(timer);
  return el;
};
