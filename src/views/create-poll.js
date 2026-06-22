// Create a poll: question + dynamic options + duration, multiple-choice and an
// optional private (invite-only) mode that generates single-use codes.
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { createPoll } from "../services/polls.js";

/** @returns {Promise<HTMLElement>} */
export default async function createPollView({ communityId }) {
  const el = document.createElement("main");
  el.className = "shell shell-narrow";
  /** @type {string[]} */
  const options = ["", ""];

  const optionRows = () =>
    options
      .map(
        (v, i) => html`
          <div class="option-row">
            <input class="input" data-option="${i}" value="${esc(v)}" placeholder="Option ${i + 1}" />
            ${options.length > 2 ? html`<button type="button" class="icon-btn" data-remove="${i}" aria-label="Remove">✕</button>` : ""}
          </div>`,
      )
      .join("");

  const render = () => {
    el.innerHTML = html`
      <a class="back" href="/c/${esc(communityId)}">← Back</a>
      <h1 class="page-title">New poll</h1>
      <form class="form card" data-form novalidate>
        <label class="field"><span>Question</span>
          <input class="input" name="question" autocomplete="off" />
        </label>
        <div class="field"><span>Options</span>
          <div data-options>${optionRows()}</div>
          ${options.length < 10 ? html`<button type="button" class="btn btn-ghost btn-sm" data-add>+ Add option</button>` : ""}
        </div>
        <div class="field-row">
          <label class="field"><span>Duration (days)</span>
            <input class="input" type="number" name="duration" value="7" min="1" max="365" />
          </label>
          <label class="check"><input type="checkbox" name="multiple" /> <span>Allow multiple choices</span></label>
        </div>
        <label class="check"><input type="checkbox" name="private" data-private /> <span>Private (invite-only)</span></label>
        <label class="field" data-invite hidden><span>Invite codes to generate</span>
          <input class="input" type="number" name="inviteCount" value="5" min="1" max="500" />
        </label>
        <p class="form-error" data-error hidden></p>
        <div class="row"><button class="btn" type="submit">Create poll</button></div>
      </form>
    `;
    wire();
  };

  const syncOptions = () =>
    el.querySelectorAll("[data-option]").forEach((inp) => { options[+inp.dataset.option] = inp.value; });

  const wire = () => {
    const form = el.querySelector("[data-form]");
    const err = el.querySelector("[data-error]");

    el.querySelector("[data-add]")?.addEventListener("click", () => { syncOptions(); options.push(""); render(); });
    el.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => { syncOptions(); options.splice(+b.dataset.remove, 1); render(); }),
    );
    const priv = el.querySelector("[data-private]");
    priv.addEventListener("change", () => { el.querySelector("[data-invite]").hidden = !priv.checked; });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      syncOptions();
      const question = form.question.value.trim();
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (!question) return showError(err, "A question is required.");
      if (opts.length < 2) return showError(err, "Add at least two options.");
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const poll = await createPoll({
          communityId,
          question,
          options: opts,
          durationDays: Number(form.duration.value) || 7,
          allowMultipleChoices: form.multiple.checked,
          isPrivate: form.private.checked,
          inviteCodeCount: form.private.checked ? Number(form.inviteCount.value) || 0 : 0,
        });
        navigate(`/poll/${poll.id}`);
      } catch (e2) {
        btn.disabled = false;
        showError(err, e2?.message || "Failed to create poll.");
      }
    });
  };

  render();
  return el;
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
