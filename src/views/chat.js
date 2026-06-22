// Direct messages: a conversation list + an end-to-end encrypted thread. The
// keypair is set up on mount (publishes our public `chatKey`); messages decrypt
// live via subscribeConversation. Start a new chat by pasting a 0x address.
import { initChat, sendMessage, subscribeConversation, subscribeInbox, listConversations } from "../services/chat.js";
import { activeAddress } from "../services/identity.js";
import { abbr } from "../state/session.js";
import { timeAgo } from "../utils/format.js";
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
        <h1 class="page-title">Messages</h1>
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
  let activePeer = null;

  const renderConvs = async () => {
    const convs = await listConversations();
    convList.innerHTML = convs.length
      ? convs
          .map(
            (c) =>
              `<li><button class="conv ${c.id === activePeer ? "active" : ""}" data-peer="${esc(c.id)}">
                <span class="conv-addr">${esc(abbr(c.id))}</span><time>${timeAgo(c.lastAt)}</time></button></li>`,
          )
          .join("")
      : `<li class="conv-empty muted">No conversations yet.</li>`;
  };

  const openThread = async (peer) => {
    activePeer = peer;
    unsubThread?.();
    unsubThread = null;
    threadBox.innerHTML = `
      <header class="thread-head">
        <span class="thread-peer">${esc(abbr(peer))}</span>
        <span class="lock-badge" title="End-to-end encrypted (RSA-OAEP)">🔒 E2E encrypted</span>
      </header>
      <div class="messages" data-messages></div>
      <form class="composer" data-send>
        <input class="input" name="text" placeholder="Type an encrypted message…" autocomplete="off" />
        <button class="btn btn-primary" type="submit">Send</button>
      </form>`;
    const msgBox = threadBox.querySelector("[data-messages]");
    threadBox.querySelector("[data-send]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = e.target.elements.text;
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      try {
        await sendMessage(peer, text);
      } catch (err) {
        input.value = text;
        alert(err.message);
      }
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
    unsubThread?.();
    unsubInbox?.();
  };
  return el;
};
