// Celebrate when the active identity climbs a karma tier. Imported eagerly from
// main.js. Watches every postVote/commentVote change (debounced), re-derives the
// active user's karma, and fires a toast only on an upward tier crossing — never
// on the initial read, never on a drop. Karma stays derived; nothing is stored.
import { TYPE } from "../db/schema.js";
import { onChange } from "../db/store.js";
import { identity } from "../state/session.js";
import { getKarma } from "./identity.js";
import { badgeForKarma, TIERS } from "./badges.js";
import { celebrateTier } from "../ui/toast.js";

function start(address) {
  let current = badgeForKarma(getKarma(address));
  let timer = null;

  const recheck = () => {
    if (identity() !== address) return; // identity changed mid-flight
    const tier = badgeForKarma(getKarma(address));
    if (TIERS.indexOf(tier) > TIERS.indexOf(current)) celebrateTier(tier);
    current = tier;
  };
  const ping = () => {
    clearTimeout(timer);
    timer = setTimeout(recheck, 900); // coalesce vote bursts into one re-derive
  };

  const unsub = onChange(ping, [TYPE.postVote, TYPE.commentVote]);
  return () => { clearTimeout(timer); unsub(); };
}

let stop = null;
identity.subscribe((address) => {
  stop?.();
  stop = null;
  if (address) stop = start(address);
});
