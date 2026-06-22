// Celebrate when the active identity climbs a karma tier. Imported eagerly from
// main.js. Watches every postVote/commentVote change (debounced), re-derives the
// active user's karma, and fires a toast only on an upward tier crossing — never
// on the initial read, never on a drop. Karma stays derived; nothing is stored.
import { db } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";
import { identity } from "../state/session.js";
import { getKarma } from "./identity.js";
import { badgeForKarma, TIERS } from "./badges.js";
import { celebrateTier } from "../ui/toast.js";

async function start(address) {
  let current = badgeForKarma(await getKarma(address));
  let timer = null;

  const recheck = async () => {
    if (identity() !== address) return; // identity changed mid-flight
    const tier = badgeForKarma(await getKarma(address));
    if (TIERS.indexOf(tier) > TIERS.indexOf(current)) celebrateTier(tier);
    current = tier;
  };
  const ping = () => {
    clearTimeout(timer);
    timer = setTimeout(recheck, 900); // coalesce vote bursts into one re-derive
  };

  const a = await db.map({ query: { type: TYPE.postVote } }, ping);
  const b = await db.map({ query: { type: TYPE.commentVote } }, ping);
  return () => {
    clearTimeout(timer);
    a.unsubscribe?.();
    b.unsubscribe?.();
  };
}

let stop = null;
identity.subscribe(async (address) => {
  stop?.();
  stop = null;
  if (address) stop = await start(address);
});
