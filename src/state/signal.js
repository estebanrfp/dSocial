// Minimal reactive primitive — a value plus subscribers. No framework, no virtual
// DOM. GenosDB already drives data reactivity via db.map; this covers local UI
// state (active identity, current route params, toggles).

/**
 * Create a reactive signal.
 * @template T
 * @param {T} initial
 * @returns {{ (): T, set(v: T): void, update(fn: (v: T) => T): void,
 *            subscribe(fn: (v: T) => void, immediate?: boolean): () => void }}
 */
export function signal(initial) {
  let value = initial;
  const subs = new Set();

  const read = () => value;
  read.set = (next) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const fn of subs) fn(value);
  };
  read.update = (fn) => read.set(fn(value));
  read.subscribe = (fn, immediate = true) => {
    subs.add(fn);
    if (immediate) fn(value);
    return () => subs.delete(fn);
  };
  return read;
}
