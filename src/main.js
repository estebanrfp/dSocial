// App bootstrap. Importing gdb.js runs its top-level await, so GenosDB is ready
// before the first route renders. Views are lazy-loaded by the router.
import "./db/gdb.js";
import { defineRoutes, setOutlet, startRouter } from "./router/router.js";

defineRoutes(
  [
    { path: "/", load: () => import("./views/home.js") },
    { path: "/home", load: () => import("./views/home.js") },
  ],
  {
    notFound: async () => {
      const el = document.createElement("div");
      el.className = "shell";
      el.innerHTML = `<p class="muted">Not found.</p>`;
      return el;
    },
  },
);

setOutlet(document.getElementById("app"));
startRouter();
