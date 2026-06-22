// Active identity, driven by the GenosDB Security Manager. A signal so the shell,
// onboarding gate and badges react to login/logout without polling.
import { db } from "../db/gdb.js";
import { signal } from "./signal.js";

/** Active Ethereum address, or null when no identity is active. */
export const identity = signal(db.sm?.getActiveEthAddress?.() ?? null);

// The SM pushes security-state changes (register / recover / logout).
db.sm?.setSecurityStateChangeCallback?.((state) => {
  const active = state?.isActive ?? Boolean(db.sm?.getActiveEthAddress?.());
  identity.set(active ? db.sm.getActiveEthAddress?.() ?? null : null);
});

/** Whether an identity is currently active. */
export const isLoggedIn = () => identity() !== null;

/** Abbreviate an address: 0x1234…abcd. */
export const abbr = (addr) =>
  typeof addr === "string" && addr.startsWith("0x") && addr.length > 12
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr ?? "";
