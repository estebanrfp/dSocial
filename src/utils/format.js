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

/** Human-readable byte size: "512 B", "820 KB", "1.4 MB". */
export const formatBytes = (n) => {
  if (!n || n < 1024) return `${n || 0} B`;
  const units = ["KB", "MB", "GB"];
  let value = n;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${value.toFixed(1)} ${units[i]}`;
};
