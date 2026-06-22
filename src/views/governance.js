// Governance dashboard: your live RBAC standing, the public promotion rules (the
// "constitution"), the role catalogue, a live network roster, and a one-click
// demo-superadmin activator that runs the engine (the only way promotions get
// signed). All standing/roster data is reactive via the user:<address> nodes.
import { GOVERNANCE_RULES, ROLES, SUPER_ADMINS, DEMO_SUPERADMIN_MNEMONIC } from "../db/gdb.js";
import { activeAddress, recoverWithMnemonic } from "../services/identity.js";
import { subscribeRole, subscribeRoster } from "../services/roles.js";
import { abbr } from "../state/session.js";
import { esc } from "../ui/base.js";

const ROLE_ORDER = ["guest", "member", "trusted", "superadmin"];
const ROLE_LABEL = { guest: "Guest", member: "Member", trusted: "Trusted", superadmin: "Superadmin" };

const fmtMatch = (v) =>
  Array.isArray(v?.$in) ? v.$in.join(" / ") : v?.$gte != null ? `≥ ${v.$gte}` : typeof v === "object" ? JSON.stringify(v) : v;

function ruleText(rule) {
  const conds = Object.entries(rule.if).map(([k, v]) => (k === "role" ? `role is ${fmtMatch(v)}` : `${k} ${fmtMatch(v)}`));
  const when = rule.offsetTimestamp ? ` · after ${rule.offsetTimestamp / 1000}s` : "";
  return { cond: conds.join(" and ") + when, then: rule.then.assignRole };
}

export default async () => {
  const me = activeAddress();
  const amSuper = me && SUPER_ADMINS.some((s) => s.toLowerCase() === me.toLowerCase());
  const el = document.createElement("main");
  el.className = "shell governance-page";

  el.innerHTML = `
    <header class="gov-head">
      <h1>Governance</h1>
      <p class="muted">Open, rule-driven RBAC. A zero-trust <strong>guest</strong> earns higher roles through public rules — every promotion cryptographically signed by a superadmin. No server, no manual gatekeeping.</p>
    </header>

    <section class="gov-card" data-standing></section>

    <section class="gov-card">
      <h2>The constitution</h2>
      <p class="muted small">Each rule is a GenosDB query run against your <code>user:&lt;address&gt;</code> node every 4s while a superadmin is online. Last match wins → climbing overrides the floor, losing a condition auto-demotes.</p>
      <ol class="rules">
        ${GOVERNANCE_RULES.map((r) => {
          const t = ruleText(r);
          return `<li><span class="rule-if"><b>IF</b> ${esc(t.cond)}</span><span class="rule-arrow">→</span><span class="role-chip role-${esc(t.then)}">${esc(ROLE_LABEL[t.then] || t.then)}</span></li>`;
        }).join("")}
      </ol>
    </section>

    <section class="gov-card">
      <h2>Roles &amp; permissions</h2>
      <div class="role-grid">
        ${ROLE_ORDER.map(
          (r) =>
            `<div class="role-card"><span class="role-chip role-${r}">${ROLE_LABEL[r]}</span><span class="role-can muted small">${esc((ROLES[r]?.can || []).join(", "))}</span></div>`,
        ).join("")}
      </div>
    </section>

    <section class="gov-card">
      <h2>Network roster</h2>
      <ul class="roster" data-roster><li class="muted small">Loading…</li></ul>
    </section>

    <section class="gov-card gov-demo">
      <h2>Run the engine</h2>
      <p class="muted small">Promotions are signed only while a superadmin is online. Activate the throwaway demo superadmin (its key signs every promotion) — then, in another tab, a fresh guest climbs to member ~5s after its node syncs.</p>
      <button class="btn btn-primary btn-sm" data-super ${amSuper ? "disabled" : ""}>${amSuper ? "✓ Demo superadmin active — engine running here" : "🛡️ Activate demo superadmin"}</button>
    </section>`;

  const standingBox = el.querySelector("[data-standing]");
  const renderStanding = (role, node) => {
    if (!me) {
      standingBox.innerHTML = `<h2>Your standing</h2><p class="muted">Create an identity to participate.</p>`;
      return;
    }
    const isSuper = amSuper || role === "superadmin";
    const shown = isSuper ? "superadmin" : role;
    const postCount = node?.postCount ?? 0;
    const progress =
      !isSuper && role === "member"
        ? `<div class="progress"><div class="bar" style="width:${Math.min(100, (postCount / 3) * 100)}%"></div></div>
           <span class="small muted">${postCount}/3 posts toward <strong>trusted</strong></span>`
        : "";
    const note = isSuper
      ? `<p class="muted small">You are the root of trust — immune to the rules. Your key signs every promotion.</p>`
      : role === "guest"
        ? `<p class="muted small">⏳ A superadmin promotes you to <strong>member</strong> ~5s after your node syncs. Keep a superadmin tab open.</p>`
        : role === "trusted"
          ? `<p class="muted small">✅ Top earned tier. Drop below 3 posts and you auto-demote to member.</p>`
          : "";
    standingBox.innerHTML = `
      <h2>Your standing</h2>
      <div class="standing-row">
        <span class="addr mono">${esc(abbr(me))}</span>
        <span class="role-chip role-${esc(shown)} big">${esc(ROLE_LABEL[shown] || shown)}</span>
      </div>
      ${note}${progress}`;
  };
  renderStanding(amSuper ? "superadmin" : "guest", {});

  const rosterBox = el.querySelector("[data-roster]");
  el.querySelector("[data-super]").addEventListener("click", async () => {
    if (!window.confirm("Log in as the demo superadmin in THIS tab? The governance engine runs here and signs promotions. Open another tab to act as a normal user.")) return;
    try {
      await recoverWithMnemonic(DEMO_SUPERADMIN_MNEMONIC);
      window.location.href = "/governance";
    } catch (e) {
      alert(e.message);
    }
  });

  let unsubRole = null;
  if (me) unsubRole = await subscribeRole(me, renderStanding);
  const unsubRoster = await subscribeRoster((rows) => {
    rosterBox.innerHTML = rows.length
      ? rows
          .map(
            (u) =>
              `<li><span class="addr mono">${esc(abbr(u.address))}</span><span class="role-chip role-${esc(u.role)}">${esc(ROLE_LABEL[u.role] || u.role)}</span>${u.postCount ? `<span class="small muted">${u.postCount} posts</span>` : ""}</li>`,
          )
          .join("")
      : `<li class="muted small">No members yet.</li>`;
  });

  el._cleanup = () => {
    unsubRole?.();
    unsubRoster?.();
  };
  return el;
};
