// Network page: live P2P status + connected peers, straight from GenosRTC. Drives
// home the showcase point — no server, peers sync directly over WebRTC.
import { html, esc } from "../ui/base.js";
import { subscribePeers } from "../services/net.js";
import { GDB_NAME } from "../db/gdb.js";

export default async () => {
  const el = document.createElement("main");
  el.className = "shell network-page";
  el.innerHTML = html`
    <h1 class="page-title">Network</h1>
    <p class="muted">InterPoll runs entirely peer-to-peer over GenosRTC (WebRTC). No server stores your data — every peer in the <code>${esc(GDB_NAME)}</code> room syncs directly.</p>
    <section class="settings-card">
      <div class="net-status" data-status></div>
      <h2>Connected peers <span class="muted small" data-count>0</span></h2>
      <ul class="peer-list" data-peers></ul>
    </section>`;

  const statusBox = el.querySelector("[data-status]");
  const countBox = el.querySelector("[data-count]");
  const peersBox = el.querySelector("[data-peers]");

  const unsub = subscribePeers((peers) => {
    countBox.textContent = peers.length;
    statusBox.innerHTML = `<span class="net-dot ${peers.length ? "on" : "off"}"></span>${
      peers.length ? `Connected to ${peers.length} peer${peers.length > 1 ? "s" : ""}` : "Waiting for peers…"
    }`;
    peersBox.innerHTML = peers.length
      ? peers.map((p) => `<li class="mono">${esc(String(p).slice(0, 20))}…</li>`).join("")
      : `<li class="muted small">No peers yet — open InterPoll in another browser or tab to see live sync.</li>`;
  });

  el._cleanup = () => unsub?.();
  return el;
};
