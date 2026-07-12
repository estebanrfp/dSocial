// Cellular-mesh visualizer (Canvas) for the Network view.
//
// Reads LIVE cell/bridge state from dSocial's own GenosDB instance (which runs in
// `cells` mode, see db/gdb.js) and draws cells in a row, their member peers in a
// ring, and the inter-cell chain. Condensed from GenosDB's
// examples/mesh-cells-monitor-modern.html — same data model and layout, no message
// animations, themed with the app's design tokens.
import { db } from "../db/gdb.js";
import { getPeerType } from "../services/net.js";

/** Resolve a CSS custom property to a literal color (canvas can't use var()). */
const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const shortId = (id) => (id && id.length > 10 ? `${id.slice(0, 4)}..${id.slice(-4)}` : id || "");
const cellIndex = (cid) => {
  const m = String(cid || "").match(/cell-(\d+)/);
  return m ? Number(m[1]) : NaN;
};

/**
 * Mount the mesh monitor onto `container` (must be sized via CSS).
 * @param {HTMLElement} container
 * @returns {() => void} cleanup to call on unmount
 */
export function mountMeshMonitor(container) {
  const room = db.room;
  const mesh = room?.mesh;
  const selfId = db.selfId;

  // Pull colors from the design tokens so the canvas matches the theme.
  const C = {
    cell: cssVar("--accent", "#2dd4bf"),
    cellInk: cssVar("--accent-ink", "#04211d"),
    self: cssVar("--violet", "#a78bfa"),
    peer: cssVar("--ok", "#4ade80"),
    bridge: cssVar("--warn", "#fbbf24"),
    server: cssVar("--pink", "#ec4899"),
    link: cssVar("--border-strong", "rgba(255,255,255,.13)"),
    text: cssVar("--text-dim", "#9aa39d"),
  };
  const FONT = cssVar("--mono", "ui-monospace, monospace");

  const canvas = document.createElement("canvas");
  canvas.className = "mesh-canvas";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let selfState = { cellId: null, isBridge: false, bridges: [] };
  const remote = new Map(); // peerId -> { cellId, isBridge, bridges }
  let W = 0, H = 0, raf = 0, dirty = true;
  const invalidate = () => { dirty = true; };

  // Seed from the current mesh snapshot so we render immediately (don't wait for
  // the next heartbeat to re-broadcast state).
  try {
    const st = mesh?.getState?.();
    if (st) selfState = { cellId: st.cellId, isBridge: !!st.isBridge, bridges: st.bridges || [] };
    const info = mesh?.getPeerInfo?.();
    if (info) for (const [id, v] of info) {
      if (id !== selfId) remote.set(id, { cellId: v.cell, isBridge: !!v.isBridge, bridges: v.bridges || [], at: Date.now() });
    }
  } catch {}

  const allPeers = () => {
    // Expire gossip-only ghosts: peers from other cells never emit
    // peer:leave, so drop entries with no fresh state for 90s and no live
    // RTC connection (physically connected background tabs stay).
    const cutoff = Date.now() - 90000;
    const connected = room?.getPeers?.() ?? {};
    const m = new Map();
    for (const [id, st] of remote) {
      if ((st.at ?? 0) < cutoff && !(id in connected)) { remote.delete(id); continue; }
      m.set(id, st);
    }
    if (selfId) m.set(selfId, { cellId: selfState.cellId, isBridge: selfState.isBridge, bridges: selfState.bridges });
    return m;
  };

  // Cells laid out left→right; member peers in a ring around each cell hub.
  function layout() {
    const cells = new Map();
    for (const [id, st] of allPeers()) {
      const c = st.cellId || "cell-0";
      if (!cells.has(c)) cells.set(c, []);
      cells.get(c).push({ id, ...st });
    }
    const sorted = [...cells.keys()].sort((a, b) => cellIndex(a) - cellIndex(b));
    const pad = 50, n = sorted.length || 1;
    const cw = Math.min(220, (W - pad * 2) / n);
    const x0 = (W - cw * n) / 2 + cw / 2;
    const out = { cells: [], peers: [], links: [] };
    sorted.forEach((cid, ci) => {
      const cx = x0 + ci * cw, cy = H / 2;
      out.cells.push({ x: cx, y: cy, label: `C${cellIndex(cid)}` });
      const ps = cells.get(cid) || [];
      const step = (Math.PI * 2) / Math.max(ps.length, 1);
      const r = Math.min(64, cw / 3);
      ps.forEach((p, i) => {
        const a = step * i - Math.PI / 2;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        out.peers.push({ x: px, y: py, isSelf: p.id === selfId, isBridge: !!p.isBridge, isServer: getPeerType(p.id) === "superpeer", label: shortId(p.id) });
        out.links.push({ x1: px, y1: py, x2: cx, y2: cy, type: "member" });
      });
      if (ci < sorted.length - 1) {
        out.links.push({ x1: cx + 22, y1: cy, x2: x0 + (ci + 1) * cw - 22, y2: cy, type: "cell" });
      }
    });
    return out;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (!W || !H) return;
    const lo = layout();

    for (const l of lo.links) {
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.strokeStyle = l.type === "cell" ? C.cell : C.link;
      ctx.lineWidth = l.type === "cell" ? 2 : 1;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of lo.cells) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = C.cell;
      ctx.fill();
      ctx.fillStyle = C.cellInk;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(c.label, c.x, c.y);
    }

    for (const p of lo.peers) {
      const r = p.isSelf ? 11 : p.isServer ? 10 : p.isBridge ? 9 : 7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.isSelf ? C.self : p.isServer ? C.server : p.isBridge ? C.bridge : C.peer;
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.font = `10px ${FONT}`;
      ctx.fillText(p.label, p.x, p.y + r + 11);
    }
  }

  function loop() {
    if (dirty) { dirty = false; render(); }
    raf = requestAnimationFrame(loop);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = container.clientWidth;
    H = container.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset transform each resize (no scale accumulation)
    invalidate();
  }

  // Live updates from the cellular mesh.
  const onJoin = () => invalidate();
  const onLeave = (id) => { remote.delete(id); invalidate(); };
  // Repaint only on real model changes — the engine re-gossips unchanged
  // state every ~10s as a keep-alive, which must refresh liveness, not CPU.
  const sig = (st) => `${st.cellId}|${st.isBridge}|${(st.bridges || []).join(",")}`;
  const onSelf = (s) => {
    const next = { cellId: s.cellId, isBridge: !!s.isBridge, bridges: Array.isArray(s.bridges) ? s.bridges : [] };
    const changed = sig(next) !== sig(selfState);
    selfState = next;
    if (changed) invalidate();
  };
  const onPeer = (d) => {
    if (d.id === selfId) return;
    const prev = remote.get(d.id);
    const next = { cellId: d.cell, isBridge: !!d.isBridge, bridges: Array.isArray(d.bridges) ? d.bridges : [], at: Date.now() };
    remote.set(d.id, next); // keep-alives always refresh `at`
    if (!prev || sig(next) !== sig(prev)) invalidate();
  };
  room?.on?.("peer:join", onJoin);
  room?.on?.("peer:leave", onLeave);
  room?.on?.("mesh:state", onSelf);
  room?.on?.("mesh:peer-state", onPeer);

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  loop();
  // Ghost sweep: silent gossip-only peers expire inside allPeers() — this
  // pulse repaints so they actually disappear even with no events arriving.
  const sweep = setInterval(invalidate, 15000);

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(sweep);
    ro.disconnect();
    room?.off?.("peer:join", onJoin);
    room?.off?.("peer:leave", onLeave);
    room?.off?.("mesh:state", onSelf);
    room?.off?.("mesh:peer-state", onPeer);
    canvas.remove();
  };
}
