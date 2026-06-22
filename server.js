// Dev server: Bun bundles index.html (+ its JS/CSS) with HMR, and serves the
// intact GenosDB folder from /genosdb/*. The "/*" route is the SPA fallback so
// client-side routes resolve to the bundled app.
import index from "./index.html";

const root = import.meta.dir;
const PORT = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  development: { hmr: true, console: true },
  routes: {
    // Serve GenosDB's dist verbatim (more specific than the SPA catch-all).
    "/genosdb/*": async (req) => {
      const { pathname } = new URL(req.url);
      const file = Bun.file(`${root}/public${pathname}`);
      return (await file.exists())
        ? new Response(file)
        : new Response("Not found", { status: 404 });
    },
    "/*": index,
  },
});

console.log(`▸ interpoll-vanilla running at ${server.url}`);
