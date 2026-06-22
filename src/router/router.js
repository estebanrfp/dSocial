// Minimal history-API router with lazy-loaded views. A route maps a path pattern
// (with :params) to `load: () => import('../views/x.js')`; the view module's
// default export is `async (params) => Node`. Internal <a href="/…"> clicks are
// intercepted for SPA navigation.

/** @type {Array<{ path: string, load: () => Promise<any>, keys: string[], regex: RegExp }>} */
const routes = [];
let outlet = null;
let notFound = null;

function compile(path) {
  const keys = [];
  const pattern = path.replace(/:([^/]+)/g, (_, k) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { keys, regex: new RegExp(`^${pattern}$`) };
}

/** Register the route table. `opts.notFound` is `() => Node`. */
export function defineRoutes(list, opts = {}) {
  routes.length = 0;
  for (const r of list) routes.push({ ...r, ...compile(r.path) });
  notFound = opts.notFound ?? null;
}

/** The element where matched views are mounted. */
export function setOutlet(el) {
  outlet = el;
}

/** Navigate to a path (pushes history unless already there) and render. */
export function navigate(to) {
  if (to !== location.pathname + location.search) history.pushState({}, "", to);
  return renderRoute();
}

async function renderRoute() {
  const path = location.pathname;
  for (const r of routes) {
    const m = path.match(r.regex);
    if (!m) continue;
    const params = Object.fromEntries(
      r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]),
    );
    const query = Object.fromEntries(new URLSearchParams(location.search));
    const mod = await r.load();
    const node = await mod.default({ ...params, query });
    if (node) mount(node);
    return;
  }
  if (notFound) mount(await notFound());
}

/** Swap the outlet's content, cleaning up the outgoing view's subscriptions. */
function mount(node) {
  outlet.firstElementChild?._cleanup?.();
  outlet.replaceChildren(node);
}

window.addEventListener("popstate", renderRoute);

document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href^='/']");
  if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});

/** Render the current location. Call once after setOutlet + defineRoutes. */
export const startRouter = () => renderRoute();
