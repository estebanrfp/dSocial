// User profile: avatar, name, address, governance role, bio, derived stats
// (karma / posts / comments / communities) and the user's posts. Your own profile
// gets an inline editor (display name + bio) and a link to settings.
import { html, esc } from "../ui/base.js";
import { navigate } from "../router/router.js";
import { getProfile, getUserStats, getUserPosts, updateProfile, activeAddress } from "../services/identity.js";
import { getRole } from "../services/roles.js";
import { uploadImage, getImage } from "../services/images.js";
import { abbr } from "../state/session.js";
import { timeAgo } from "../utils/format.js";
import { stripMarkdown } from "../utils/markdown.js";
import { SUPER_ADMINS } from "../db/gdb.js";

const ROLE_LABEL = { guest: "Guest", member: "Member", trusted: "Trusted", superadmin: "Superadmin" };

export default async (params) => {
  const me = activeAddress();
  const address = params?.address || me;
  const el = document.createElement("main");
  el.className = "shell profile-page";
  if (!address) {
    el.innerHTML = `<p class="muted">Create an identity to view profiles.</p>`;
    return el;
  }

  const isMe = me && address.toLowerCase() === me.toLowerCase();
  const [profile, stats, role, posts] = await Promise.all([
    getProfile(address),
    getUserStats(address),
    getRole(address),
    getUserPosts(address),
  ]);
  const isSuper = SUPER_ADMINS.some((s) => s.toLowerCase() === address.toLowerCase());
  const shownRole = isSuper ? "superadmin" : role;
  const displayName = profile?.displayName || abbr(address);
  const bio = profile?.bio || "";

  el.innerHTML = html`
    <header class="profile-head">
      <div class="avatar xl" data-avatar>${esc(displayName.charAt(0).toUpperCase())}</div>
      <div class="profile-head-body">
        <h1 class="page-title">${esc(displayName)}</h1>
        <div class="profile-meta">
          <span class="addr mono">${esc(abbr(address))}</span>
          <span class="role-chip role-${esc(shownRole)}">${esc(ROLE_LABEL[shownRole] || shownRole)}</span>
        </div>
        ${bio ? html`<p class="profile-bio">${esc(bio)}</p>` : ""}
      </div>
      ${
        isMe
          ? html`<div class="profile-actions">
              <button class="btn btn-ghost btn-sm" data-edit>Edit profile</button>
              <a class="btn btn-ghost btn-sm" href="/settings">Settings</a>
            </div>`
          : ""
      }
    </header>

    <div class="stat-row">
      <div class="stat"><span class="stat-num">${stats.karma}</span><span class="stat-label">Karma</span></div>
      <div class="stat"><span class="stat-num">${stats.posts}</span><span class="stat-label">Posts</span></div>
      <div class="stat"><span class="stat-num">${stats.comments}</span><span class="stat-label">Comments</span></div>
      <div class="stat"><span class="stat-num">${stats.communities}</span><span class="stat-label">Communities</span></div>
    </div>

    <h2 class="section-title">Posts</h2>
    <div class="grid" data-posts></div>
  `;

  const postsBox = el.querySelector("[data-posts]");
  postsBox.innerHTML = posts.length
    ? posts
        .map(
          (p) =>
            html`<a class="post-card" href="/p/${esc(p.id)}"><div class="post-body"><h3>${esc(p.title)}</h3>${
              p.content ? html`<p class="muted">${esc(stripMarkdown(p.content).slice(0, 140))}</p>` : ""
            }<span class="meta">${esc(timeAgo(p.createdAt))}</span></div></a>`,
        )
        .join("")
    : html`<div class="empty"><p>No posts yet.</p></div>`;

  if (profile?.avatarId) {
    getImage(profile.avatarId).then((d) => {
      const av = el.querySelector("[data-avatar]");
      if (d && av) av.innerHTML = `<img src="${d}" alt="" />`;
    });
  }

  if (isMe) {
    el.querySelector("[data-edit]").addEventListener("click", () => {
      const head = el.querySelector(".profile-head");
      head.innerHTML = html`
        <form class="profile-edit" data-pform>
          <label class="field">Avatar
            <input class="input file-input" name="avatar" type="file" accept="image/*" />
          </label>
          <label class="field">Display name
            <input class="input" name="displayName" value="${esc(profile?.displayName || "")}" maxlength="40" placeholder="Your name" autocomplete="off" />
          </label>
          <label class="field">Bio
            <textarea class="input" name="bio" rows="3" maxlength="200" placeholder="A short bio">${esc(profile?.bio || "")}</textarea>
          </label>
          <div class="row gap">
            <button class="btn btn-primary btn-sm" type="submit">Save</button>
            <button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button>
          </div>
        </form>`;
      head.querySelector("[data-cancel]").addEventListener("click", () => {
        navigate("/profile");
      });
      head.querySelector("[data-pform]").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const btn = f.namedItem ? e.target.querySelector("button[type=submit]") : null;
        try {
          const file = f.avatar.files?.[0];
          let avatarId = profile?.avatarId;
          if (file) {
            if (btn) btn.textContent = "Uploading…";
            avatarId = await uploadImage(file, { maxDim: 400 });
          }
          await updateProfile({ displayName: f.displayName.value.trim(), bio: f.bio.value.trim(), avatarId });
          navigate("/profile");
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  return el;
};
