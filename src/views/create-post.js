// Create a post in a community (title + Markdown content). On success, return to
// the community feed.
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { createPost } from "../services/posts.js";
import { uploadImage } from "../services/images.js";

/** @returns {Promise<HTMLElement>} */
export default async function createPostView({ communityId }) {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";
  el.innerHTML = html`
    <a class="back" href="/c/${esc(communityId)}">← Back</a>
    <h1 class="page-title">New post</h1>
    <form class="form card" data-form novalidate>
      <label class="field">
        <span>Title</span>
        <input class="input" name="title" autocomplete="off" />
      </label>
      <label class="field">
        <span>Content <em class="opt">Markdown</em></span>
        <textarea class="input" name="content" rows="8" placeholder="Write something…"></textarea>
      </label>
      <label class="field">
        <span>Image <em class="opt">optional</em></span>
        <input class="input file-input" name="image" type="file" accept="image/*" />
        <img class="img-preview" data-preview hidden alt="Preview" />
      </label>
      <p class="form-error" data-error hidden></p>
      <div class="row"><button class="btn" type="submit">Publish</button></div>
    </form>
  `;

  const form = el.querySelector("[data-form]");
  const err = el.querySelector("[data-error]");
  const preview = el.querySelector("[data-preview]");
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
      await createPost({ communityId, title, content: form.content.value, imageId });
      navigate(`/c/${communityId}`);
    } catch (e2) {
      btn.disabled = false;
      btn.textContent = "Publish";
      err.textContent = e2?.message || "Failed to publish.";
      err.hidden = false;
    }
  });

  return el;
}
