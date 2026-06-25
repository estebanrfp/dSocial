// Onboarding gate: a fixed overlay shown whenever no identity is active. Two
// paths — create a fresh BIP39 identity (mnemonic shown once, must be saved) or
// recover from a phrase. Optionally protect with a WebAuthn passkey.
import { identity, mnemonic } from "../state/session.js";
import {
  createIdentity,
  recoverWithMnemonic,
  protectWithWebAuthn,
  hasWebAuthn,
  loginWithWebAuthn,
  ensureProfile,
} from "../services/identity.js";
import { esc } from "../ui/base.js";
import { copyButton, wireCopy } from "../ui/copy.js";

/** Mount the onboarding overlay into `root`; it shows/hides with the identity signal. */
export function mountOnboarding(root) {
  const overlay = document.createElement("div");
  overlay.className = "onboarding";
  root.appendChild(overlay);

  let view = "choose"; // choose | mnemonic | recover

  const render = () => {
    // Hide only once an identity is active. During "create" the volatile identity
    // is NOT active until the user confirms (recover-with-its-own-phrase on
    // continue), so the mnemonic screen stays up naturally while addr is null.
    if (identity()) {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;

    if (view === "mnemonic") {
      const words = (mnemonic() || "").split(/\s+/).filter(Boolean);
      overlay.innerHTML = card(`
        <div class="mnemonic-head">
          <h2>Save your recovery phrase</h2>
          ${copyButton("Copy phrase")}
        </div>
        <p class="muted">These 12 words ARE your account. Store them safely — they are
          shown once and never saved anywhere.</p>
        <ol class="mnemonic">${words.map((w) => `<li>${esc(w)}</li>`).join("")}</ol>
        <div class="row">
          <button class="btn" data-act="continue">I saved it — continue</button>
          ${hasWebAuthn() === false ? `<button class="btn btn-ghost" data-act="protect">Protect with passkey</button>` : ""}
        </div>
      `);
    } else if (view === "recover") {
      overlay.innerHTML = card(`
        <h2>Recover identity</h2>
        <p class="muted">Enter your 12-word recovery phrase.</p>
        <textarea class="input" data-phrase rows="3" placeholder="word1 word2 word3 …"></textarea>
        <p class="form-error" data-error hidden></p>
        <div class="row">
          <button class="btn" data-act="recover">Recover</button>
          <button class="btn btn-ghost" data-act="back">Back</button>
        </div>
      `);
    } else {
      overlay.innerHTML = card(`
        <div class="brand brand-lg">dSocial</div>
        <h2>Your identity, your keys</h2>
        <p class="muted">A peer-to-peer network with no accounts server. Create a signed
          identity to participate, or recover an existing one.</p>
        <div class="row">
          <button class="btn" data-act="create">Create new identity</button>
          <button class="btn btn-ghost" data-act="recover-view">Recover with phrase</button>
        </div>
        ${hasWebAuthn() ? `<button class="btn btn-link" data-act="webauthn">Log in with passkey</button>` : ""}
      `);
    }
    wire();
  };

  const card = (inner) => `<div class="onboarding-card card">${inner}</div>`;

  const setError = (msg) => {
    const e = overlay.querySelector("[data-error]");
    if (e) { e.textContent = msg; e.hidden = !msg; }
  };

  const wire = () => {
    overlay.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.getAttribute("data-act");
        try {
          if (act === "create") {
            view = "mnemonic"; // switch first so the gate stays open when the SM activates
            render();
            const id = await createIdentity();
            if (!id) { view = "choose"; render(); return setError("Could not create identity."); }
            mnemonic.set(id.mnemonic);
          } else if (act === "recover-view") {
            view = "recover";
            render();
          } else if (act === "back") {
            view = "choose";
            render();
          } else if (act === "recover") {
            const phrase = overlay.querySelector("[data-phrase]")?.value || "";
            if (phrase.trim().split(/\s+/).length < 12) return setError("Enter all 12 words.");
            btn.disabled = true;
            const addr = await recoverWithMnemonic(phrase);
            if (!addr) { btn.disabled = false; return setError("Invalid phrase."); }
            await ensureProfile();
          } else if (act === "continue") {
            // Activate the just-generated volatile identity using its own phrase.
            await recoverWithMnemonic(mnemonic());
            await ensureProfile();
            view = "choose";
          } else if (act === "protect") {
            await protectWithWebAuthn();
            await ensureProfile();
            view = "choose";
          } else if (act === "webauthn") {
            await loginWithWebAuthn();
            await ensureProfile();
          }
        } catch (err) {
          console.error("Onboarding error:", err);
          setError(err?.message || "Something went wrong.");
        }
      });
    });
    wireCopy(overlay, mnemonic);
  };

  identity.subscribe(render);
  mnemonic.subscribe(() => { if (view === "mnemonic") render(); }, false);
}
