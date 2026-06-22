// Web Component base + tiny templating helpers. Components extend `Component`,
// implement `render()` returning an HTML string, and register cleanups with
// `track()` (e.g. signal/db.map unsubscribers) that run on disconnect.

/** HTML-escape a value for safe interpolation into templates. */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

/** Tagged template returning a plain HTML string. Escape interpolations with esc(). */
export const html = (strings, ...values) =>
  strings.reduce((acc, s, i) => acc + s + (i < values.length ? values[i] ?? "" : ""), "");

/** Base custom element with lifecycle, cleanup tracking and innerHTML rendering. */
export class Component extends HTMLElement {
  constructor() {
    super();
    /** @type {Array<() => void>} */
    this._cleanups = [];
  }

  connectedCallback() {
    this.onMount?.();
    this.update();
  }

  disconnectedCallback() {
    for (const fn of this._cleanups) fn();
    this._cleanups = [];
    this.onUnmount?.();
  }

  /** Register a teardown fn (a subscribe()/db.map unsubscribe). */
  track(unsub) {
    if (typeof unsub === "function") this._cleanups.push(unsub);
  }

  /** Re-render from current state, then run afterRender (for event wiring). */
  update() {
    this.innerHTML = this.render();
    this.afterRender?.();
  }

  /** @returns {string} HTML */
  render() {
    return "";
  }
}

/** Register a custom element once. */
export const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
};
