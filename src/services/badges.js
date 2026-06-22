// Karma badges — a derived reward tier per identity, like everything else in the
// app it's computed from signed votes, never stored. Badges are hand-drawn inline
// SVGs (no GIFs, no external API, no library) so they stay vectorial, animated via
// CSS, themed by tokens, and true to the "GenosDB is the only dependency" thesis.
import { esc } from "../ui/base.js";

/**
 * Tiers, ascending. `min` is the karma floor; `a`/`b` are the metal/gem gradient
 * stops; `shape` picks the SVG. Last-match-wins when resolving a karma value.
 * @type {{key:string,name:string,min:number,a:string,b:string,shape:string}[]}
 */
export const TIERS = [
  { key: "spark", name: "Spark", min: 0, a: "#aeb6c4", b: "#6b7280", shape: "spark" },
  { key: "bronze", name: "Bronze", min: 3, a: "#f0b07a", b: "#a85f2e", shape: "medal" },
  { key: "silver", name: "Silver", min: 10, a: "#eef2f8", b: "#97a1b2", shape: "medal" },
  { key: "gold", name: "Gold", min: 25, a: "#ffe187", b: "#e0a414", shape: "medal" },
  { key: "crystal", name: "Crystal", min: 50, a: "#8af2e3", b: "#14b8a6", shape: "gem" },
  { key: "legend", name: "Legend", min: 100, a: "#dcc0ff", b: "#a855f7", shape: "crown" },
];

/** The tier earned at a given karma (clamped at 0 — negative karma stays Spark). */
export function badgeForKarma(karma) {
  const k = Number(karma) || 0;
  let tier = TIERS[0];
  for (const t of TIERS) if (k >= t.min) tier = t;
  return tier;
}

/** Progress toward the next tier: { next, need, pct } — next is null at the top. */
export function progressToNext(karma) {
  const k = Number(karma) || 0;
  const i = TIERS.findIndex((t) => t === badgeForKarma(k));
  const next = TIERS[i + 1] || null;
  if (!next) return { next: null, need: 0, pct: 100 };
  const floor = TIERS[i].min;
  const pct = Math.max(0, Math.min(100, ((k - floor) / (next.min - floor)) * 100));
  return { next, need: Math.max(0, next.min - k), pct };
}

// ── SVG shapes ────────────────────────────────────────────────────────────────
// Each returns the inner markup for a 48×48 viewBox; the gradient id is unique per
// call so multiple badges on one page don't collide.
const shapes = {
  spark: () =>
    `<path class="badge-fill" d="M24 5 Q26 18 38 20 Q26 22 24 35 Q22 22 10 20 Q22 18 24 5Z"/>
     <circle class="badge-spark-dot" cx="37" cy="11" r="2"/>`,
  medal: () =>
    `<path class="badge-ribbon" d="M17 4h5l2 14h-5z"/><path class="badge-ribbon" d="M31 4h-5l-2 14h5z"/>
     <circle class="badge-fill" cx="24" cy="30" r="13"/>
     <circle class="badge-ring" cx="24" cy="30" r="13"/>
     <path class="badge-star" d="M24 22l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.8z"/>`,
  gem: () =>
    `<path class="badge-fill" d="M24 5 L41 19 L24 43 L7 19Z"/>
     <path class="badge-facet" d="M24 5 L41 19 L24 19Z"/><path class="badge-facet2" d="M7 19 L24 19 L24 5Z"/>
     <path class="badge-facet3" d="M24 19 L41 19 L24 43Z"/>`,
  crown: () =>
    `<path class="badge-fill" d="M7 17l6 7 11-15 11 15 6-7v22H7z"/>
     <rect class="badge-base" x="7" y="35" width="34" height="5" rx="1.5"/>
     <circle class="badge-jewel" cx="24" cy="14" r="2.4"/><circle class="badge-jewel" cx="11" cy="20" r="2"/><circle class="badge-jewel" cx="37" cy="20" r="2"/>`,
};

/**
 * Render a tier's badge as an inline SVG. `size` in px; `sweep` adds the shine
 * animation (for the active/profile badge). Colors come from the tier gradient.
 */
export function badgeSvg(tier, { size = 22, sweep = false } = {}) {
  const t = typeof tier === "string" ? TIERS.find((x) => x.key === tier) || TIERS[0] : tier;
  const gid = `bg-${t.key}-${size}-${sweep ? "s" : "n"}`;
  return `<svg class="badge-svg badge-${esc(t.shape)}${sweep ? " badge-sweep" : ""}" width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="${esc(t.name)} badge"
    style="--bg-a:${esc(t.a)};--bg-b:${esc(t.b)}">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${esc(t.a)}"/><stop offset="1" stop-color="${esc(t.b)}"/>
      </linearGradient>
    </defs>
    <g fill="url(#${gid})">${shapes[t.shape]()}</g>
  </svg>`;
}

/** A compact inline badge (icon + name) for bylines. */
export function badgeChip(karma) {
  const t = badgeForKarma(karma);
  return `<span class="badge-chip" title="${esc(t.name)} · ${Number(karma) || 0} karma">${badgeSvg(t, { size: 16 })}</span>`;
}

/** The featured profile badge: animated icon + tier name + progress to next. */
export function badgeHero(karma) {
  const t = badgeForKarma(karma);
  const p = progressToNext(karma);
  const k = Number(karma) || 0;
  return `<section class="badge-hero" style="--bg-a:${esc(t.a)};--bg-b:${esc(t.b)}">
    <div class="badge-hero-icon">${badgeSvg(t, { size: 56, sweep: true })}</div>
    <div class="badge-hero-body">
      <div class="badge-hero-tier">${esc(t.name)}</div>
      <div class="badge-hero-sub">${k} karma${p.next ? ` · ${p.need} more to ${esc(p.next.name)}` : " · top tier reached 🎉"}</div>
      <div class="badge-progress"><div class="bar" style="--pct:${p.pct}%"></div></div>
    </div>
  </section>`;
}
