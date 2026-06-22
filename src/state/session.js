// Active identity + security state, driven by the GenosDB Security Manager.
// Signals so the shell, onboarding gate and badges react without polling.
import { db } from "../db/gdb.js";
import { signal } from "./signal.js";

const addr0 = db.sm?.getActiveEthAddress?.() ?? null;

/** Active Ethereum address, or null when no identity is active. */
export const identity = signal(addr0);

/** Volatile mnemonic shown once after create/recover — never persisted. */
export const mnemonic = signal(null);

/** Broader SM state for UI (WebAuthn protection, volatile identity, hardware). */
export const smState = signal({
  isActive: Boolean(addr0),
  isWebAuthnProtected: false,
  hasVolatileIdentity: false,
  hasWebAuthnHardware: db.sm?.hasExistingWebAuthnRegistration?.() ?? false,
});

// Single source of truth: the SM pushes every state change through this callback.
db.sm?.setSecurityStateChangeCallback?.((s) => {
  identity.set(s.isActive ? s.activeAddress : null);
  smState.set({
    isActive: s.isActive,
    isWebAuthnProtected: s.isWebAuthnProtected,
    hasVolatileIdentity: s.hasVolatileIdentity,
    hasWebAuthnHardware: s.hasWebAuthnHardwareRegistration,
  });
  if (!s.isActive) mnemonic.set(null);
});

/** Whether an identity is currently active. */
export const isLoggedIn = () => identity() !== null;

/** Abbreviate an address: 0x1234…abcd. */
export const abbr = (addr) =>
  typeof addr === "string" && addr.startsWith("0x") && addr.length > 12
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr ?? "";
