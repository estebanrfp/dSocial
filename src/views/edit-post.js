// Edit an existing post (author only). Reuses the create-post form pattern,
// pre-filled, with the Markdown Write/Preview toggle. The image field is optional:
// leaving it empty keeps the current image; picking one replaces it.
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { getPost, editPost } from "../services/posts.js";
import { uploadImage } from "../services/images.js";
import { renderMarkdown } from "../utils/markdown.js";
import { activeAddress } from "../services/identity.js";

/** @returns {Promise<HTMLElement>} */
export default async function editPostView({ postId }) {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";

  const post = await getPost(postId);
  if (!post) {
    el.innerHTML = html`<a class="back" href="/home">← Home</a><div class="empty"><p>Post not found.</p></div>`;
    return el;
  }
  const me = activeAddress();
  if (!me || me.toLowerCase() !== String(post.authorId).toLowerCase()) {
    el.innerHTML = html`<a class="back" href="/p/${esc(postId)}">← Back</a><div class="empty"><p>Only the author can edit this post.</p></div>`;
    return el;
  }

  el.innerHTML = html`
    <a class="back" href="/p/${esc(postId)}">← Back</a>
    <h1 class="page-title">Edit post</h1>
    <form class="form card" data-form novalidate>
      <label class="field">
        <span>Title</span>
        <input class="input" name="title" autocomplete="off" value="${esc(post.title)}" />
      </label>
      <div class="field">
        <div class="field-head">
          <span>Content <em class="opt">Markdown</em></span>
          <div class="md-tabs" data-tabs>
            <button type="button" class="md-tab is-active" data-tab="write">Write</button>
            <button type="button" class="md-tab" data-tab="preview">Preview</button>
          </div>
        </div>
        <textarea class="input" name="content" rows="8">${esc(post.content)}</textarea>
        <div class="md-preview markdown" data-md-preview hidden></div>
      </div>
      <label class="field">
        <span>Image <em class="opt">${post.imageId ? "replace — leave empty to keep" : "optional"}</em></span>
        <input class="input file-input" name="image" type="file" accept="image/*" />
        <img class="img-preview" data-preview hidden alt="Preview" />
      </label>
      <p class="form-error" data-error hidden></p>
      <div class="row"><button class="btn" type="submit">Save changes</button></div>
    </form>
  `;

  const form = el.querySelector("[data-form]");
  const err = el.querySelector("[data-error]");
  const preview = el.querySelector("[data-preview]");

  const tabs = el.querySelector("[data-tabs]");
  const mdPreview = el.querySelector("[data-md-preview]");
  tabs.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    const isPreview = tab.dataset.tab === "preview";
    tabs.querySelectorAll(".md-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
    if (isPreview) {
      const md = form.content.value.trim();
      mdPreview.innerHTML = md ? renderMarkdown(md) : `<p class="muted">Nothing to preview yet.</p>`;
      mdPreview.style.minHeight = `${form.content.offsetHeight}px`;
    }
    form.content.hidden = isPreview;
    mdPreview.hidden = !isPreview;
  });
  form.image.addEventListener("change", () => {
    const file = form.image.files?.[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const title = form.title.value.trim();
    if (!title) { err.textContent = "A title is required."; err.hidden = false; return; }
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      const file = form.image.files?.[0];
      let imageId;
      if (file) {
        btn.textContent = "Uploading image…";
        imageId = await uploadImage(file);
      }
      await editPost(postId, { title, content: form.content.value, imageId });
      navigate(`/p/${postId}`);
    } catch (e2) {
      btn.disabled = false;
      btn.textContent = "Save changes";
      err.textContent = e2?.message || "Failed to save.";
      err.hidden = false;
    }
  });

  return el;
}
