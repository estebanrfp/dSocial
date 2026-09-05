// Static server for the built app (dist/) with SPA fallback. Used by `serve` and
// (after a watch build) `dev`.
const OUT = `${import.meta.dir}/dist`;
const PORT = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = Bun.file(`${OUT}${pathname === "/" ? "/index.html" : pathname}`);
    return (await file.exists())
      ? new Response(file)
      : new Response(Bun.file(`${OUT}/index.html`)); // SPA fallback
  },
});

console.log(`▸ dsocial running at ${server.url}`);
