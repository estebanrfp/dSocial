// Small formatting helpers.

/** Compact relative time: "just now", "5m", "3h", "2d", or a date. */
export function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

/** Pluralize: count(1,'member') → "1 member". */
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
