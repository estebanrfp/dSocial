// Minimal copy-to-clipboard button: a small icon-only button that briefly flips
// to a check on success. Reused by the onboarding mnemonic screen and the Settings
// recovery-phrase reveal. Wire the markup with wireCopy().

const ICON_COPY = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

/** HTML for a minimal icon-only copy button. Pair it with wireCopy(). */
export const copyButton = (label = "Copy") =>
  `<button type="button" class="copy-btn" data-copy aria-label="${label}" title="${label}">${ICON_COPY}</button>`;

/**
 * Wire every `[data-copy]` button inside `root` to copy `getText()` to the
 * clipboard, flipping the icon to a check for 1.5s. Clipboard failures (insecure
 * context / denied permission) are ignored silently.
 * @param {ParentNode} root
 * @param {() => string} getText
 */
export const wireCopy = (root, getText) => {
  for (const btn of root.querySelectorAll("[data-copy]")) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(getText() ?? "");
        btn.innerHTML = ICON_CHECK;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.innerHTML = ICON_COPY;
          btn.classList.remove("copied");
        }, 1500);
      } catch {
        /* clipboard unavailable — no-op */
      }
    });
  }
};
