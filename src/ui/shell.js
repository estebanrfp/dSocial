// App shell: a sticky top bar (brand + primary nav + identity badge) and the
// router outlet. Mounted once; the badge reacts to the identity signal.
import { identity, abbr } from "../state/session.js";
import { logout } from "../services/identity.js";
import { esc } from "./base.js";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/chatrooms", label: "Chat" },
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
  const renderBadge = (addr) => {
    right.innerHTML = addr
      ? `<a class="id-pill" href="/profile" title="Your profile">${esc(abbr(addr))}</a>
         <button class="btn btn-ghost btn-sm" data-logout>Log out</button>`
      : "";
    right.querySelector("[data-logout]")?.addEventListener("click", () => logout());
  };
  identity.subscribe(renderBadge);

  return root.querySelector("#outlet");
}
