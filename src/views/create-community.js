// Create a community. One name field derives the deterministic id; description is
// optional. On success, navigate to the new community.
import { html } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { createCommunity } from "../services/communities.js";

/** @returns {Promise<HTMLElement>} */
export default async function createCommunityView() {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";
  el.innerHTML = html`
    <a class="back" href="/home">← Communities</a>
    <h1 class="page-title">New community</h1>
    <form class="form card" data-form novalidate>
      <label class="field">
        <span>Name</span>
        <input class="input" name="name" placeholder="my-community" autocomplete="off" />
        <small class="muted" data-slug></small>
      </label>
      <label class="field">
        <span>Display name <em class="opt">optional</em></span>
        <input class="input" name="displayName" placeholder="My Community" />
      </label>
      <label class="field">
        <span>Description <em class="opt">optional</em></span>
        <textarea class="input" name="description" rows="3" placeholder="What is it about?"></textarea>
      </label>
      <p class="form-error" data-error hidden></p>
      <div class="row"><button class="btn" type="submit">Create community</button></div>
    </form>
  `;

  const form = el.querySelector("[data-form]");
  const slug = el.querySelector("[data-slug]");
  const err = el.querySelector("[data-error]");

  form.name.addEventListener("input", () => {
    const s = form.name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
    slug.textContent = s ? `Will live at /c/c-${s}` : "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = form.name.value.trim();
    if (name.length < 2) { err.textContent = "Name must be at least 2 characters."; err.hidden = false; return; }
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      const c = await createCommunity({
        name,
        displayName: form.displayName.value.trim() || name,
        description: form.description.value.trim(),
        rules: [],
      });
      navigate(`/c/${c.id}`);
    } catch (e2) {
      btn.disabled = false;
      err.textContent = e2?.message || "Failed to create community.";
      err.hidden = false;
    }
  });

  return el;
}
