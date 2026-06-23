// App shell: a sticky top bar (brand + primary nav + identity badge) and the
// router outlet. Mounted once; the badge reacts to the identity signal.
import { identity } from "../state/session.js";
import { displayNameFor, onNameChange } from "../services/names.js";
import { logout } from "../services/identity.js";
import { subscribeRole } from "../services/roles.js";
import { SUPER_ADMINS } from "../db/gdb.js";
import { esc } from "./base.js";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/chat", label: "Chat" },
];

/**
 * Build the shell into `root` and return the outlet element for the router.
 * @param {HTMLElement} root
 * @returns {HTMLElement} outlet
 */
export function mountShell(root) {
  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <a class="brand" href="/home">InterPoll</a>
        <nav class="nav">
          ${NAV.map((n) => `<a class="nav-link" href="${n.href}">${esc(n.label)}</a>`).join("")}
        </nav>
        <div class="topbar-right"></div>
      </header>
      <div id="outlet" class="outlet"></div>
    </div>
  `;

  const right = root.querySelector(".topbar-right");
  let unsubRole = null;
  const renderBadge = (addr) => {
    unsubRole?.();
    unsubRole = null;
    right.innerHTML = addr
      ? `<a class="id-role role-chip role-guest" href="/governance" title="Your role — governance" data-rolechip>guest</a>
         <a class="id-pill" href="/profile" title="Your profile">${esc(displayNameFor(addr))}</a>
         <button class="btn btn-ghost btn-sm" data-logout>Log out</button>`
      : "";
    right.querySelector("[data-logout]")?.addEventListener("click", () => logout());
    if (!addr) return;
    const isSuper = SUPER_ADMINS.some((s) => s.toLowerCase() === addr.toLowerCase());
    const chip = right.querySelector("[data-rolechip]");
    subscribeRole(addr, (role) => {
      const shown = isSuper ? "superadmin" : role;
      if (chip) {
        chip.textContent = shown;
        chip.className = `id-role role-chip role-${shown}`;
      }
    }).then((u) => (unsubRole = u));
  };
  identity.subscribe(renderBadge);
  // Update my own id-pill the moment my profile gets (or changes) a name.
  onNameChange((changed) => {
    const addr = identity();
    if (addr && changed === addr) {
      const pill = right.querySelector(".id-pill");
      if (pill) pill.textContent = displayNameFor(addr);
    }
  });

  return root.querySelector("#outlet");
}
