// Transient celebratory toasts. A single fixed stack, bottom-right, auto-dismiss.
import { esc } from "./base.js";
import { badgeSvg } from "../services/badges.js";

let stack;
function ensureStack() {
  if (stack) return stack;
  stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.appendChild(stack);
  return stack;
}

/** Show a toast (inner HTML); auto-dismisses, or click to close early. */
export function showToast(inner, { duration = 5200 } = {}) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = inner;
  ensureStack().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("in"));
  const close = () => {
    toast.classList.remove("in");
    setTimeout(() => toast.remove(), 320);
  };
  const timer = setTimeout(close, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    close();
  });
}

/** Celebrate climbing into a new karma tier. */
export function celebrateTier(tier) {
  showToast(
    `<div class="toast-badge">${badgeSvg(tier, { size: 46, sweep: true })}</div>
     <div class="toast-body">
       <strong>${esc(tier.name)} unlocked!</strong>
       <span>Your karma reached a new tier 🎉</span>
     </div>`,
  );
}
