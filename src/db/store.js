// THE single reactive subscription for the entire app.
//
// GenosDB's reactivity degrades once several db.map() listeners are open at the same
// time — and an app like this naturally wants one per service and per view. So the WHOLE
// app shares ONE db.map (no query → it sees every node). It keeps a live in-memory mirror
// of the graph and fans every change out to in-memory subscribers. Services read with
// `select()` / `value()` and react with `onChange()` — they must NEVER open their own
// db.map. The data is already local (GenosDB synced it), so these reads are synchronous
// and instant; no network, no extra subscriptions.
import { db } from "./gdb.js";

const graph = new Map(); // id -> node value: a live mirror of the whole database
const listeners = new Set(); // (event) => void, run on every node change

// The ONE db.map. Its callback is the only reactive DB entry point in the app.
// `action` is one of 'initial' | 'added' | 'updated' | 'removed' (value is null on removed).
await db.map(({ id, value, action }) => {
  if (action === "removed") graph.delete(id);
  else if (value != null) graph.set(id, value);
  for (const fn of listeners) fn({ id, value, action });
});

/** Live nodes whose value matches `predicate`, read straight from the in-memory mirror. */
export const select = (predicate) => {
  const out = [];
  for (const [id, value] of graph) if (predicate(value)) out.push({ id, value });
  return out;
};

/** One node's value by id, or null (in-memory, synchronous). */
export const value = (id) => graph.get(id) ?? null;

/**
 * React to node changes. `cb(event)` runs on every change; pass `types` (a string or
 * array of node `type`s) to only fire for those — the common case for a view. Returns an
 * unsubscribe. This is an in-memory listener: it does NOT open a new db.map.
 */
export const onChange = (cb, types) => {
  const want = types == null ? null : new Set([].concat(types));
  const listener = (e) => {
    if (want && !want.has(e.value?.type) && e.action !== "removed") return;
    cb(e);
  };
  listeners.add(listener);
  return () => listeners.delete(listener);
};
