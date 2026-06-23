# GOAL — Phase 2: Advanced GenosDB capabilities (performance-first)

Extend the InterPoll Vanilla showcase to demonstrate GenosDB's **advanced,
performance-defining capabilities** — the ones a casual port never reaches. Every
addition must be **elegant, minimal and technically superior**, and must make the
same point: *GenosDB is fast and scales; the "it's slow" claims come from heavy
frameworks and inherited complexity, not from the database.*

## Strategy (why we build this)

The narrative to prove, in code:

- A **framework-free** vanilla app on GenosDB stays instant under load.
- Slowness people blame on "the database" is really **framework weight + legacy
  complexity + naive data patterns** (loading everything into memory, re-rendering
  whole trees, etc.).
- We refute it by using **GenosDB's native fast paths** — cursor pagination, the
  radix-tree index, real-time P2P channels — not by loading 10k nodes and sorting
  in JS.

Performance is not a side effect here — it is the **headline**. Where it helps the
point, include a way to *show* it (seed a large dataset and prove the feed stays
instant).

## NON-NEGOTIABLE — Official sources are the source of truth

Before using ANY GenosDB API or operator, **read the official docs and examples
first**; never assume a signature or behavior. On any doubt, STOP and read the
source. Canonical locations:

- Docs:     `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/docs/`
- Examples: `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/examples/`
- Operators truth: `…/GenosDB/lib/components/Operators.js`
- The `genosdb` skill index.

Per-capability sources are listed below; match the documented API exactly.

## Capabilities to implement (priority = strategy order)

### 1. Cursor-based pagination — the #1 "it's not slow" proof  ← START HERE
Replace "load every node + sort in memory" with native cursor pagination
(`$after` / `$before` / `$limit`) + infinite scroll, on the heavy feeds: community
posts, a post's comments, and search results. Keep live reactivity.
- Sources: `docs/cursor‐based-pagination.md`, `examples/pagination.html`,
  `examples/infinite-scroll.html`, `docs/map-guide.md`.
- Done when: a large seeded community shows its first page instantly and scrolls
  without loading the whole set; live updates still work.

### 2. Advanced search — prefix index (rx)  ⛔ BLOCKED (engine bug in 0.16.0)
- **rx (radix tree)** — intended: `$startsWith` / `searchByPrefix` for indexed prefix
  autocomplete. **Verified NON-FUNCTIONAL in 0.16.0** with the rtc+sm setup: the module
  loads (`db.searchByPrefix` exists) but the index stays empty after `db.put` (every
  prefix → 0 results) and `{ id: { $startsWith } }` throws `o.filter is not a function`
  inside `rx.min.js`. Tested exactly per `docs/rx-radix-tree.md`. Same shape as the
  geo-module disconnect fixed in 0.15.1. **Cannot be fixed from the app** (GenosDB is
  read-only). → Options for Esteban: (a) fix rx in the engine + bump the npm version,
  then implement; (b) non-indexed fallback (`$like`/`$regex` prefix scan — works but
  doesn't showcase the index); (c) skip to capability #3 (GenosRTC live).
  Sources: `docs/rx-radix-tree.md`.
- **Dropped by Esteban for this showcase:** `nlq` and `audit`.

### 3. GenosRTC live (real-time P2P beyond sync)
Ephemeral data channels for **live presence + typing indicators** ("viewing now",
"X is typing") on posts/chat; optionally **voice/video rooms** via `room.addStream`.
Shows sub-second P2P latency — another face of "fast".
- Sources: `docs/genosrtc-guide.md`, `docs/genosrtc-api-reference.md`,
  `examples/cursor.html`, `examples/chat.html`, `examples/audio-streaming.html`,
  `examples/video-streaming.html`.

## Explicitly OUT of scope (decided, not forgotten)
- Social graph / follows (`db.link` + `$edge`): nice conceptually but **not central
  to the performance story**; revisit later if wanted.
- `geo` ($near/$bbox), `genosrtc-cells` (mesh), `ai`: not coherent for a general
  forum / not UI-demonstrable here.
- `sm.put`/`sm.get`: redundant — E2E is already covered by the app's AES/RSA.

## Inherited rules (unchanged)
- Pure vanilla JS, **no UI framework, no TypeScript, no CSS framework**; no inline
  styles, CSS variables/tokens, JSDoc on public functions, comments/logs in English.
- GenosDB and the `interpoll-genosdb` fork are **read-only references** — never modify.
- Bundle GenosDB the canonical way (`import { gdb } from "genosdb"`); plugins are
  copied beside the bundle by `scripts/copy-genosdb.js`. Enabling a module (rx/nlq/
  audit) means adding its flag to the `gdb(...)` init — the `*.min.js` is already
  copied, but verify it lands in `dist/` and is fetched, not 404'd.
- Conventional commits, **no AI attribution trailer**. Push verified, correct changes
  to `main` to finish (auto-deploys) — don't ask each time.

## Definition of Done (per capability)
- Official sources read first; the used API matches the docs exactly.
- Real-browser E2E verification, **zero console errors**, clean `bun run build`.
- For pagination/search: a visible performance demonstration (large dataset stays
  instant).
- Design stays minimal and coherent with the existing product.
