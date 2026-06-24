// Direct messages: a conversation list + an end-to-end encrypted thread. The
// keypair is set up on mount (publishes our public `chatKey`); messages decrypt
// live via subscribeConversation. Start a new chat by pasting a 0x address.
import { initChat, sendMessage, subscribeConversation, subscribeInbox, listConversations, subscribeTyping, sendTyping } from "../services/chat.js";
import { activeAddress } from "../services/identity.js";
import { displayNameFor } from "../services/names.js";
import { sendFileTo, onFile, MAX_FILE_BYTES, isOnline, onRoster, peerIdFor } from "../services/p2p.js";
import { timeAgo, formatBytes } from "../utils/format.js";
import { esc } from "../ui/base.js";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export default async (params) => {
  const me = activeAddress();
  const el = document.createElement("main");
  el.className = "shell chat-page";
  if (!me) {
    el.innerHTML = `<p class="muted">Create an identity to send messages.</p>`;
    return el;
  }

  el.innerHTML = `
    <div class="chat-layout">
      <aside class="chat-sidebar">
        <nav class="chat-tabs">
          <a class="chat-tab active" href="/chat">Direct</a>
          <a class="chat-tab" href="/rooms">Rooms</a>
        </nav>
        <form class="dm-start" data-start>
          <input class="input" name="peer" placeholder="Recipient address (0x…)" autocomplete="off" spellcheck="false" />
          <button class="btn btn-primary btn-sm" type="submit">Start</button>
        </form>
        <ul class="conv-list" data-convs></ul>
      </aside>
      <section class="chat-thread" data-thread>
        <div class="chat-empty muted">Select or start a conversation.</div>
      </section>
    </div>`;

  await initChat();

  const convList = el.querySelector("[data-convs]");
  const threadBox = el.querySelector("[data-thread]");
  let unsubThread = null;
  let unsubTyping = null;
  let unsubRoster = null;
  let typingTimer = null;
  let activePeer = null;

  const renderConvs = async () => {
    const convs = await listConversations();
    convList.innerHTML = convs.length
      ? convs
          .map(
            (c) =>
              `<li><button class="conv ${c.id === activePeer ? "active" : ""}" data-peer="${esc(c.id)}">
                <span class="conv-addr">${esc(displayNameFor(c.id))}</span><time>${timeAgo(c.lastAt)}</time></button></li>`,
          )
          .join("")
      : `<li class="conv-empty muted">No conversations yet.</li>`;
  };

  const openThread = async (peer) => {
    if (activePeer && activePeer !== peer) sendTyping(activePeer, false); // stop typing in the old thread
    activePeer = peer;
    unsubThread?.();
    unsubThread = null;
    unsubTyping?.();
    unsubTyping = null;
    unsubRoster?.();
    unsubRoster = null;
    clearTimeout(typingTimer);
    threadBox.innerHTML = `
      <header class="thread-head">
        <span class="thread-peer">${esc(displayNameFor(peer))}<span class="peer-status" data-status></span></span>
        <span class="lock-badge" title="End-to-end encrypted (RSA-OAEP)">🔒 E2E encrypted</span>
      </header>
      <div class="messages" data-messages></div>
      <div class="transfers" data-transfers></div>
      <div class="typing-ind muted small" data-typing hidden><span class="typing-dots"><span></span><span></span><span></span></span>${esc(displayNameFor(peer))} is typing</div>
      <form class="composer" data-send>
        <input type="file" data-file hidden />
        <button type="button" class="icon-btn attach-btn" data-attach title="Send a file (peer-to-peer)" aria-label="Send a file">📎</button>
        <input class="input" name="text" placeholder="Type an encrypted message…" autocomplete="off" />
        <button class="btn btn-primary" type="submit">Send</button>
      </form>`;
    const msgBox = threadBox.querySelector("[data-messages]");
    const typingEl = threadBox.querySelector("[data-typing]");
    const transfersEl = threadBox.querySelector("[data-transfers]");
    const composer = threadBox.querySelector("[data-send]");
    const input = composer.elements.text;
    const fileInput = threadBox.querySelector("[data-file]");
    const attachBtn = threadBox.querySelector("[data-attach]");
    const statusEl = threadBox.querySelector("[data-status]");

    // Connection status — file transfer requires BOTH peers connected.
    const updateStatus = () => {
      const on = isOnline(peer);
      statusEl.className = `peer-status ${on ? "online" : "offline"}`;
      statusEl.title = on ? "Connected — file transfer available" : "Offline — can't transfer files";
      attachBtn.disabled = !on;
      attachBtn.title = on ? "Send a file (peer-to-peer)" : "Offline — both must be connected to transfer";
    };
    updateStatus();
    unsubRoster = onRoster(updateStatus);

    // 1:1 file transfer with a live progress bar (sender + receiver sides).
    const bars = new Map(); // key -> { row, fill, pct }
    const bar = (key, name, dir) => {
      let b = bars.get(key);
      if (!b) {
        const row = document.createElement("div");
        row.className = `transfer transfer-${dir}`;
        row.innerHTML = `<span class="transfer-name">${dir === "in" ? "↓" : "↑"} ${esc(name)}</span><span class="transfer-bar"><span class="transfer-fill"></span></span><span class="transfer-pct">0%</span>`;
        transfersEl.appendChild(row);
        transfersEl.scrollTop = transfersEl.scrollHeight;
        b = { row, pct: row.querySelector(".transfer-pct") };
        bars.set(key, b);
      }
      return b;
    };
    const setPct = (key, p) => {
      const b = bars.get(key);
      if (b) { b.row.style.setProperty("--pct", p); b.pct.textContent = `${Math.round(p * 100)}%`; }
    };

    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (file.size > MAX_FILE_BYTES)
        return alert(`"${file.name}" is too large (${formatBytes(file.size)}). Direct P2P transfer is capped at ${formatBytes(MAX_FILE_BYTES)} — pick a smaller file.`);
      if (!isOnline(peer)) return alert("This person is offline — you can only send files while both of you are connected.");
      const key = `out:${file.name}:${Date.now()}`;
      bar(key, `${file.name} · ${formatBytes(file.size)}`, "out");
      try {
        const result = await sendFileTo(peer, file, (p) => setPct(key, p));
        if (result === "sent") {
          setPct(key, 1);
          bars.get(key).row.classList.add("done");
          bars.get(key).pct.textContent = "Sent ✓";
        } else {
          bars.get(key).row.remove();
          bars.delete(key);
          alert(result === "too-large" ? "File too large for direct transfer." : "This person went offline.");
        }
      } catch (err) {
        bars.get(key)?.row.remove();
        bars.delete(key);
        alert("Transfer failed: " + (err?.message || err));
      }
    });

    // Receive files from THIS conversation's peer (handlers are global; filter by peerId).
    onFile(
      (data, fromPeerId, meta) => {
        if (peerIdFor(peer) !== fromPeerId) return;
        const key = `in:${fromPeerId}:${meta.filename}`;
        const b = bar(key, `${meta.filename} · ${formatBytes(meta.size)}`, "in");
        setPct(key, 1);
        const url = URL.createObjectURL(new Blob([data], { type: meta.type || "application/octet-stream" }));
        b.pct.innerHTML = `<a class="transfer-dl" href="${url}" download="${esc(meta.filename)}">Download</a>`;
        b.row.classList.add("done");
      },
      (percent, fromPeerId, meta) => {
        if (peerIdFor(peer) !== fromPeerId) return;
        bar(`in:${fromPeerId}:${meta.filename}`, `${meta.filename} · ${formatBytes(meta.size)}`, "in");
        setPct(`in:${fromPeerId}:${meta.filename}`, percent);
      },
    );

    composer.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      clearTimeout(typingTimer);
      sendTyping(peer, false); // stop the indicator the moment we send
      try {
        await sendMessage(peer, text);
      } catch (err) {
        input.value = text;
        alert(err.message);
      }
    });

    // Broadcast my typing state, auto-clearing after 2s idle (fork's pattern).
    input.addEventListener("input", () => {
      sendTyping(peer, true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => sendTyping(peer, false), 2000);
    });

    unsubTyping = subscribeTyping(peer, (isTyping) => {
      if (typingEl) typingEl.hidden = !isTyping;
    });

    unsubThread = await subscribeConversation(peer, (msgs) => {
      msgBox.innerHTML = msgs
        .map(
          (m) =>
            `<div class="msg ${m.mine ? "mine" : "theirs"}"><p>${esc(m.text)}</p><time>${timeAgo(m.timestamp)}</time></div>`,
        )
        .join("");
      msgBox.scrollTop = msgBox.scrollHeight;
    });
    renderConvs();
  };

  el.querySelector("[data-start]").addEventListener("submit", (e) => {
    e.preventDefault();
    const peer = e.target.elements.peer.value.trim();
    if (!ADDR_RE.test(peer)) return alert("Enter a valid 0x… address.");
    if (peer.toLowerCase() === me.toLowerCase()) return alert("You can't message yourself.");
    e.target.reset();
    openThread(peer);
  });

  convList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-peer]");
    if (btn) openThread(btn.dataset.peer);
  });

  await renderConvs();
  const unsubInbox = await subscribeInbox(renderConvs);
  if (params?.peerId && ADDR_RE.test(params.peerId)) await openThread(params.peerId);

  el._cleanup = () => {
    if (activePeer) sendTyping(activePeer, false); // clear my "typing" when leaving the chat
    unsubThread?.();
    unsubTyping?.();
    unsubRoster?.();
    clearTimeout(typingTimer);
    unsubInbox?.();
    onFile(null, null); // stop receiving files when leaving the chat view
  };
  return el;
};
