// Encrypted group rooms: a list of joined rooms + create/join panels + a
// decrypting message thread. The room AES key lives in a local vault; messages
// decrypt live. Shares the chat shell (sub-tabs switch Direct <-> Rooms).
import {
  createRoom,
  joinRoom,
  joinPublicRoom,
  sendRoomMessage,
  subscribeRoomMessages,
  listJoinedRooms,
  listPublicRooms,
  countRoomMembers,
  subscribeRooms,
  leaveRoom,
  roomInviteToken,
  parseInvite,
} from "../services/chatrooms.js";
import { activeAddress } from "../services/identity.js";
import { abbr } from "../state/session.js";
import { timeAgo } from "../utils/format.js";
import { esc } from "../ui/base.js";

const tabs = (active) => `
  <nav class="chat-tabs">
    <a class="chat-tab ${active === "direct" ? "active" : ""}" href="/chat">Direct</a>
    <a class="chat-tab ${active === "rooms" ? "active" : ""}" href="/rooms">Rooms</a>
  </nav>`;

export default async () => {
  const me = activeAddress();
  const el = document.createElement("main");
  el.className = "shell chat-page";
  if (!me) {
    el.innerHTML = `<p class="muted">Create an identity to use rooms.</p>`;
    return el;
  }

  el.innerHTML = `
    <div class="chat-layout">
      <aside class="chat-sidebar">
        ${tabs("rooms")}
        <div class="room-actions">
          <button class="btn btn-primary btn-sm" data-act="new">+ New room</button>
          <button class="btn btn-ghost btn-sm" data-act="join">Join</button>
        </div>
        <div class="room-panel" data-panel hidden></div>
        <ul class="conv-list" data-rooms></ul>
      </aside>
      <section class="chat-thread" data-thread>
        <div class="chat-empty muted">Select, create, or join a room.</div>
      </section>
    </div>`;

  const roomList = el.querySelector("[data-rooms]");
  const threadBox = el.querySelector("[data-thread]");
  const panel = el.querySelector("[data-panel]");
  let unsubThread = null;
  let activeRoom = null;

  const renderRooms = async () => {
    const joined = await listJoinedRooms();
    const joinedIds = new Set(joined.map((r) => r.id));
    const discover = listPublicRooms().filter((r) => !joinedIds.has(r.id)); // public rooms I'm not in
    const joinedHtml = joined
      .map(
        (r) =>
          `<li><button class="conv room ${r.id === activeRoom ? "active" : ""}" data-room="${esc(r.id)}">
            <span class="conv-addr">${esc(r.name)}</span><span class="room-count">${r.memberCount}&nbsp;members</span></button></li>`,
      )
      .join("");
    const discoverHtml = discover.length
      ? `<li class="conv-section muted">Discover</li>` +
        discover
          .map(
            (r) =>
              `<li><button class="conv room room-public" data-join-public="${esc(r.id)}" title="${esc(r.description || "Public room")}">
                <span class="conv-addr">🌐 ${esc(r.name)}</span><span class="room-count">${r.memberCount}&nbsp;members · Join</span></button></li>`,
          )
          .join("")
      : "";
    roomList.innerHTML =
      joined.length || discover.length ? joinedHtml + discoverHtml : `<li class="conv-empty muted">No rooms yet — create or join one.</li>`;
  };

  const openRoom = async (roomId) => {
    activeRoom = roomId;
    unsubThread?.();
    unsubThread = null;
    const room = (await listJoinedRooms()).find((r) => r.id === roomId);
    if (!room) return;
    const isOwner = room.creatorId === me;
    threadBox.innerHTML = `
      <header class="thread-head">
        <div><span class="thread-peer">${esc(room.name)}</span> <span class="room-sub muted">${room.memberCount} members</span></div>
        <div class="thread-actions">
          <span class="lock-badge" title="AES-256-GCM encrypted">🔒 ${esc(room.encryptionHint)}</span>
          <button class="btn btn-ghost btn-sm" data-invite>Invite</button>
          <button class="btn btn-ghost btn-sm" data-leave>Leave</button>
        </div>
      </header>
      <div class="messages" data-messages></div>
      <form class="composer" data-send>
        <input class="input" name="text" placeholder="Encrypted message to the room…" autocomplete="off" />
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
        await sendRoomMessage(roomId, text, abbr(me));
      } catch (err) {
        input.value = text;
        alert(err.message);
      }
    });
    threadBox.querySelector("[data-invite]").addEventListener("click", async () => {
      const token = await roomInviteToken(roomId);
      window.prompt("Share this invite (paste it in Join):", token);
    });
    threadBox.querySelector("[data-leave]").addEventListener("click", async () => {
      if (!window.confirm("Leave this room? You'll lose its key.")) return;
      await leaveRoom(roomId);
      activeRoom = null;
      unsubThread?.();
      unsubThread = null;
      threadBox.innerHTML = `<div class="chat-empty muted">Select, create, or join a room.</div>`;
      renderRooms();
    });
    unsubThread = await subscribeRoomMessages(roomId, (msgs) => {
      msgBox.innerHTML = msgs
        .map(
          (m) =>
            `<div class="msg ${m.mine ? "mine" : "theirs"}">${
              m.mine ? "" : `<span class="msg-sender">${esc(m.senderName || abbr(m.senderId))}</span>`
            }<p>${esc(m.text)}</p><time>${timeAgo(m.timestamp)}</time></div>`,
        )
        .join("");
      msgBox.scrollTop = msgBox.scrollHeight;
    });
    renderRooms();
  };

  const closePanel = () => {
    panel.hidden = true;
    panel.innerHTML = "";
  };

  const showNewPanel = () => {
    panel.hidden = false;
    panel.innerHTML = `
      <form class="room-form" data-newform>
        <input class="input" name="name" placeholder="Room name" required autocomplete="off" />
        <input class="input" name="description" placeholder="Description (optional)" autocomplete="off" />
        <input class="input" name="password" type="password" placeholder="Password (optional → invite-only)" data-pw />
        <label class="room-public-toggle"><input type="checkbox" name="isPublic" data-public /> Public — anyone can discover &amp; join</label>
        <div class="row gap"><button class="btn btn-primary btn-sm" type="submit">Create</button>
          <button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button></div>
      </form>`;
    panel.querySelector("[data-cancel]").addEventListener("click", closePanel);
    // Public rooms have no password — the key derives from the public id.
    const pwInput = panel.querySelector("[data-pw]");
    panel.querySelector("[data-public]").addEventListener("change", (e) => {
      pwInput.disabled = e.target.checked;
      if (e.target.checked) pwInput.value = "";
    });
    panel.querySelector("[data-newform]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      try {
        const { room, inviteToken } = await createRoom(f.name.value.trim(), f.description.value.trim(), f.password.value, f.isPublic.checked);
        closePanel();
        await renderRooms();
        if (inviteToken) window.prompt("Room created! Share this invite:", `${room.id}#${inviteToken}`);
        openRoom(room.id);
      } catch (err) {
        alert(err.message);
      }
    });
  };

  const showJoinPanel = () => {
    panel.hidden = false;
    panel.innerHTML = `
      <form class="room-form" data-joinform>
        <input class="input" name="invite" placeholder="Paste invite (roomId#key) or room id" required autocomplete="off" />
        <input class="input" name="password" type="password" placeholder="Password (for password rooms)" />
        <div class="row gap"><button class="btn btn-primary btn-sm" type="submit">Join</button>
          <button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button></div>
      </form>`;
    panel.querySelector("[data-cancel]").addEventListener("click", closePanel);
    panel.querySelector("[data-joinform]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const { roomId, token } = parseInvite(f.invite.value);
      const method = token ? "invite" : "password";
      try {
        const room = await joinRoom(roomId, token || f.password.value, method);
        closePanel();
        await renderRooms();
        openRoom(room.id);
      } catch (err) {
        alert(err.message);
      }
    });
  };

  el.querySelector('[data-act="new"]').addEventListener("click", showNewPanel);
  el.querySelector('[data-act="join"]').addEventListener("click", showJoinPanel);
  roomList.addEventListener("click", async (e) => {
    const joinBtn = e.target.closest("[data-join-public]");
    if (joinBtn) {
      try {
        const room = await joinPublicRoom(joinBtn.dataset.joinPublic);
        await renderRooms();
        openRoom(room.id);
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    const btn = e.target.closest("[data-room]");
    if (btn) openRoom(btn.dataset.room);
  });

  // Keep the open thread's member count live too — renderRooms only refreshes the list.
  const refreshActiveCount = () => {
    if (!activeRoom) return;
    const sub = threadBox.querySelector(".room-sub");
    if (sub) sub.textContent = `${countRoomMembers(activeRoom)} members`;
  };
  await renderRooms();
  const unsubRooms = await subscribeRooms(() => { renderRooms(); refreshActiveCount(); });

  el._cleanup = () => {
    unsubThread?.();
    unsubRooms?.();
  };
  return el;
};
