// AES-256-GCM for room/group encryption: random or password-derived (PBKDF2)
// keys, a 96-bit IV prepended to the ciphertext, base64(url) export for invite
// links. Web Crypto only, no dependencies. Ported from the fork's EncryptionService.
const ALGO = "AES-GCM";
const KEY_BITS = 256;
const IV_BYTES = 12;
const PBKDF2_ITERS = 600_000;

const toB64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64Url = (s) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s) => {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return b;
};

/** Random AES-256 key (extractable, for export/sharing). */
export const generateKey = () => crypto.subtle.generateKey({ name: ALGO, length: KEY_BITS }, true, ["encrypt", "decrypt"]);

/** Derive an AES-256 key from a password via PBKDF2 (600k iterations, SHA-256). */
export async function deriveKeyFromPassword(password, salt, iterations = PBKDF2_ITERS) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    base,
    { name: ALGO, length: KEY_BITS },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt → base64(IV ‖ ciphertext). */
export async function encrypt(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt({ name: ALGO, iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.byteLength);
  return toB64(combined);
}

/** Decrypt base64(IV ‖ ciphertext). Throws on tamper / wrong key (GCM auth). */
export async function decrypt(ciphertext, key) {
  const combined = fromB64(ciphertext);
  if (combined.byteLength <= IV_BYTES) throw new Error("Payload too short");
  const iv = combined.slice(0, IV_BYTES);
  const data = combined.slice(IV_BYTES);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: ALGO, iv }, key, data));
}

export const exportKey = async (key) => toB64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
export const importKey = (key) => crypto.subtle.importKey("raw", fromB64(key), { name: ALGO, length: KEY_BITS }, true, ["encrypt", "decrypt"]);
export const exportKeyUrl = async (key) => toB64Url(await exportKey(key));
export const importKeyUrl = (urlKey) => importKey(fromB64Url(urlKey));
