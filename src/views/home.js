// Home / landing view. Phase 1 placeholder proving the router + new design system;
// it grows into the community feed in Phase 3.
import { GDB_NAME } from "../db/gdb.js";
import { identity, abbr } from "../state/session.js";

/** @returns {Promise<HTMLElement>} */
export default async function home() {
  const el = document.createElement("div");
  el.className = "page";
  const addr = identity();
  el.innerHTML = `
    <header class="topbar"><span class="brand">InterPoll</span></header>
    <main class="shell">
      <section class="hero">
        <h1>Polls &amp; forums, <span class="accent">peer&#8209;to&#8209;peer</span>.</h1>
        <p class="lede">A decentralized community network on GenosDB — every action signed,
          synced across peers, no servers and no framework.</p>
        <p class="status">
          <span class="dot ok"></span>
          GenosDB ready · room <code>${GDB_NAME}</code>${
            addr ? ` · <code>${abbr(addr)}</code>` : " · no identity yet"
          }
        </p>
      </section>
    </main>
  `;
  return el;
}
