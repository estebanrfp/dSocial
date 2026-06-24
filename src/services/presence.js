// Live "viewing now" presence over the shared `app` GenosRTC channel (never the DB). Each
// peer announces which target (a post id) it's viewing, plus its address (so the UI can show
// a name). A `presence` signal carries { address, target }; a null target clears it.
// Newcomers converge via a re-announce whenever we hear a new viewer + a 3s heartbeat (early
// announces, sent before a P2P link is up, are lost); onPeerLeave drops a peer that leaves.
import { broadcast, onSignal, onPeerLeave } from "./p2p.js";
import { activeAddress } from "./identity.js";

let currentTarget = null;
let started = false;
const peers = new Map(); // peerId -> { address, target }
const watchers = new Set();

const notify = () => { for (const fn of watchers) fn(); };

function announce() {
  const address = activeAddress();
  if (address) broadcast("presence", { address, target: currentTarget });
}

// Wire the receive side once (idempotent). On a presence we record (or clear) that peer's
// target; a peer we hear from for the first time gets a reply so it learns our state too.
function start() {
  if (started) return;
  started = true;
  onSignal("presence", (data, peerId) => {
    if (!data?.address) return;
    const isNew = !peers.has(peerId);
    if (data.target) peers.set(peerId, { address: data.address, target: data.target });
    else peers.delete(peerId);
    notify();
    if (isNew && data.target && currentTarget) announce(); // tell the newcomer what I'm viewing
  });
  onPeerLeave((peerId) => { if (peers.delete(peerId)) notify(); });
  setInterval(() => { if (currentTarget) announce(); }, 3000); // heartbeat for convergence
}

/** Announce that I'm now viewing `target` (a post id), or null to clear. */
export function setViewing(target) {
  start();
  currentTarget = target;
  announce();
}

/** Addresses of OTHER peers currently viewing `target` (deduped). */
export function viewersOf(target) {
  const addrs = new Set();
  for (const { address, target: t } of peers.values()) if (t === target) addrs.add(address);
  return [...addrs];
}

/** Subscribe to presence changes; `fn()` fires on any change. Returns an unsubscribe. */
export function onPresence(fn) {
  start();
  watchers.add(fn);
  return () => watchers.delete(fn);
}
