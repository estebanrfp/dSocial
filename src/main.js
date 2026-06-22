// App bootstrap. For now it proves the stack end-to-end: Bun bundles this module,
// GenosDB loads intact from /genosdb and initialises, and we render reactively.
// The router, state and views are built on top of this base next.
import { db, GDB_NAME } from "./db/gdb.js";

const app = document.getElementById("app");

const address = db.sm?.getActiveEthAddress?.() ?? null;

app.innerHTML = `
  <header class="topbar">
    <h1>InterPoll</h1>
  </header>
  <main class="shell">
    <section class="card">
      <p class="status">
        <span class="dot ok"></span>
        GenosDB ready · room <code>${GDB_NAME}</code>
      </p>
      <p class="muted">
        ${
          address
            ? `Active identity: <code>${address}</code>`
            : "No identity yet — onboarding (SM mnemonic) is the next build step."
        }
      </p>
    </section>
  </main>
`;
