// Settings: identity address, passkey (WebAuthn) protection, one-time recovery
// phrase reveal, and logout. Reacts to the SM state so protecting updates live.
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { activeAddress, protectWithWebAuthn, logout } from "../services/identity.js";
import { smState, mnemonic } from "../state/session.js";

export default async () => {
  const el = document.createElement("main");
  el.className = "shell settings-page";
  const addr = activeAddress();
  if (!addr) {
    el.innerHTML = `<p class="muted">No active identity.</p>`;
    return el;
  }

  const render = () => {
    const s = smState();
    const phrase = mnemonic();
    el.innerHTML = html`
      <h1 class="page-title">Settings</h1>

      <section class="settings-card">
        <h2>Identity</h2>
        <div class="set-row"><span>Address</span><span class="mono">${esc(addr)}</span></div>
        <div class="set-row"><span>Passkey protection</span><span>${s.isWebAuthnProtected ? "🔒 Protected" : "Unprotected"}</span></div>
      </section>

      ${
        s.isWebAuthnProtected
          ? ""
          : html`<section class="settings-card">
              <h2>Protect this identity</h2>
              <p class="muted small">Bind a device passkey (WebAuthn) so you can resume on this device without re-entering the recovery phrase. The key never leaves your device.</p>
              <button class="btn btn-primary btn-sm" data-protect>Protect with passkey</button>
            </section>`
      }

      ${
        phrase
          ? html`<section class="settings-card">
              <h2>Recovery phrase</h2>
              <p class="muted small">These 12 words are the <strong>only</strong> way to recover this identity. Store them offline — they are never sent anywhere.</p>
              <button class="btn btn-ghost btn-sm" data-reveal>Reveal phrase</button>
              <pre class="mnemonic-box" data-phrase hidden>${esc(phrase)}</pre>
            </section>`
          : html`<section class="settings-card">
              <h2>Recovery phrase</h2>
              <p class="muted small">The recovery phrase is shown only right after you create an identity. Protect with a passkey to resume on this device.</p>
            </section>`
      }

      <section class="settings-card">
        <h2>Explore</h2>
        <div class="set-links">
          <a class="btn btn-ghost btn-sm" href="/governance">Governance</a>
          <a class="btn btn-ghost btn-sm" href="/network">Network status</a>
        </div>
      </section>

      <section class="settings-card">
        <h2>Session</h2>
        <button class="btn btn-ghost btn-sm" data-logout>Log out</button>
      </section>`;

    el.querySelector("[data-protect]")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "Waiting for passkey…";
      try {
        await protectWithWebAuthn();
      } catch (err) {
        alert(err.message);
        e.target.disabled = false;
        e.target.textContent = "Protect with passkey";
      }
    });
    el.querySelector("[data-reveal]")?.addEventListener("click", () => {
      const p = el.querySelector("[data-phrase]");
      p.hidden = !p.hidden;
    });
    el.querySelector("[data-logout]")?.addEventListener("click", () => {
      logout();
      navigate("/");
    });
  };

  render();
  const unsub = smState.subscribe(render);
  el._cleanup = () => unsub?.();
  return el;
};
