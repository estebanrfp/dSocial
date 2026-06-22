// App bootstrap.
//
// GenosDB is initialised with a top-level await in db/gdb.js. We `await import`
// it FIRST so the engine is fully ready, then dynamically import the rest of the
// app — this guarantees no UI module touches `db` before it exists (a static
// import graph can otherwise evaluate a dependent before gdb's TLA resolves).
await import("./db/gdb.js");
await import("./services/net.js"); // start tracking P2P peers from app start
await import("./services/tier-watch.js"); // celebrate karma tier-ups with a toast

const { mountShell } = await import("./ui/shell.js");
const { mountOnboarding } = await import("./views/onboarding.js");
const { defineRoutes, setOutlet, startRouter } = await import("./router/router.js");

const root = document.getElementById("app");
const outlet = mountShell(root);
setOutlet(outlet);

defineRoutes(
  [
    { path: "/", load: () => import("./views/home.js") },
    { path: "/home", load: () => import("./views/home.js") },
    { path: "/create-community", load: () => import("./views/create-community.js") },
    { path: "/c/:communityId/new-post", load: () => import("./views/create-post.js") },
    { path: "/c/:communityId/new-poll", load: () => import("./views/create-poll.js") },
    { path: "/poll/:pollId", load: () => import("./views/poll.js") },
    { path: "/chat", load: () => import("./views/chat.js") },
    { path: "/chat/:peerId", load: () => import("./views/chat.js") },
    { path: "/rooms", load: () => import("./views/rooms.js") },
    { path: "/governance", load: () => import("./views/governance.js") },
    { path: "/profile", load: () => import("./views/profile.js") },
    { path: "/u/:address", load: () => import("./views/profile.js") },
    { path: "/settings", load: () => import("./views/settings.js") },
    { path: "/search", load: () => import("./views/search.js") },
    { path: "/network", load: () => import("./views/network.js") },
    { path: "/p/:postId/edit", load: () => import("./views/edit-post.js") },
    { path: "/p/:postId", load: () => import("./views/post.js") },
    { path: "/c/:communityId", load: () => import("./views/community.js") },
  ],
  {
    notFound: async () => {
      const el = document.createElement("main");
      el.className = "shell";
      el.innerHTML = `<p class="muted">Not found.</p>`;
      return el;
    },
  },
);

mountOnboarding(root);
startRouter();
