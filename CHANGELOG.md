# Changelog

All notable changes to **dSocial** are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/). The app runs on the latest **GenosDB**
release, its only runtime dependency, loaded from the jsDelivr CDN.

## [0.4.2] — GenosDB from the CDN

### Changed

- **GenosDB is no longer installed or bundled.** The app imports `genosdb@latest` from
  the jsDelivr CDN, where the engine resolves its plugins beside itself; the copy
  script and the npm dependency are gone, and every engine release reaches the app
  without a rebuild.

## [0.4.1] — GenosDB 0.33.4

### Changed

- **Engine upgraded from 0.25.0 to 0.33.4.** Every operation is now judged by its
  author's signature on **every** path — live, delta and full state alike (0.32.0),
  where catch-up used to apply state by clock alone. The app's constitution already
  matches that model: the base role writes, links and deletes, and every post and
  community is an owned node, so authorship decides who may change what. Ids the
  engine generates for owned values now begin with the owner's address (0.33.1),
  a removal leaves other nodes' signed edge sets alone while every read resolves
  them (0.33.2 / 0.33.3), and the operation window survives a closing tab (0.33.4).
- **One migration note.** Nodes written by 0.25.0 carry no author receipt, so they
  stop travelling to new peers until a superadmin signs in once — that sign-in
  re-signs everything it holds. Deploy the app and any always-on peer together.

## [0.4.0] — Realtime correctness, hybrid rooms & consolidation

Hardens the real-time layer and the rooms, and folds the P2P channels into one — the fixes
that turn the 0.3.0 feature sprint into a solid showcase.

### Changed

- **One app-wide `db.map` (the store).** All reactivity now flows through a single
  [`db/store.js`](src/db/store.js) subscription that mirrors the graph into memory; every
  service reads and subscribes through it (`select`/`value`/`onChange`), never opening its
  own `db.map`. This fixes the root cause of the "syncs but not live" regression: GenosDB's
  reactivity degrades once several `db.map` subscriptions are open at once. Reads are now
  synchronous — on a client-side database the data is already local after sync.
- **One GenosRTC channel for all P2P features.** The roster (address↔peerId), 1:1 file
  transfer, typing and "viewing now" presence now share a single `app` data channel
  ([`services/p2p.js`](src/services/p2p.js)), multiplexed by message `kind` — opening
  several channels alongside the DB's own sync channel was what degraded realtime. p2p.js
  exposes a generic `broadcast(kind)` / `onSignal(kind)` transport that typing (`chat.js`)
  and presence (`presence.js`) ride on. Replaces `roster.js` + `filetransfer.js` and the
  separate `chat-typing` / `presence` channels (and the `P2P_CHANNELS_ENABLED` switch).
- **Room messages show live display names.** A message byline resolves the name at render
  time (`displayNameFor(senderId)`) and re-renders on rename, instead of the abbreviated
  address that was stored on the message — so renaming a profile updates every byline live.

### Added

- **Hybrid group rooms.** A room is now **public** (clear name, listed in a live "Discover"
  directory, AES key derived from the public id → one-click join) or **private** (encrypted
  meta, invite-only, never listed). Private rooms are unchanged.
- **Owner room deletion.** The creator can delete a room; the removal propagates peer-to-peer
  and the room vanishes from every peer's directory and joined list (a module-level `removed`
  listener prunes the local vault globally). Peers' own messages stay theirs (zero-trust):
  orphaned, not force-deleted.
- **Typing indicators & "viewing now" presence (revived).** A DM shows an animated
  "… is typing" (auto-clearing after 4s idle / on send); a post shows which other connected
  peers are viewing it right now (clears on leave). Both are ephemeral signals on the shared
  `app` channel — never the database — folded in via p2p.js's `broadcast`/`onSignal`.

### Removed

- **Cursor pagination / infinite scroll.** Superseded by the reactive store: GenosDB is
  client-side, so once data has synced it is already local — the feed derives synchronously
  and stays live (new posts, deletes, scores) without paging.

### Fixed

- **Realtime regression ("syncs but not live").** Root-caused to many concurrent `db.map`
  subscriptions, plus a `pagehide → room.leave()` handler that dropped the peer on tab
  freeze (now `beforeunload`). Resolved by the single-store refactor above.
- **Governance threshold off-by-one.** `postCount` is re-derived from a direct query right
  after a write (the in-memory store lags a tick), so the 3rd post promotes to `trusted` and
  dropping back to 2 demotes to `member`, exactly on the threshold.

## [0.3.0] — Real-time P2P & scale

Pushes the showcase into GenosDB's performance- and real-time-defining capabilities —
the ones a casual port never reaches.

### Added

- **Cursor pagination + infinite scroll** — community feeds load one page at a time
  with GenosDB's native cursor pagination (`field`/`order` + `$limit`/`$after`) plus an
  `IntersectionObserver`, instead of loading every node and sorting in memory. Vote
  scores stay live; the feed is instant even with thousands of posts. (`services/posts.js`
  `loadPostsPage`/`watchPostScores`, `views/community.js`.)
- **Live typing indicators** — a DM shows an animated "… is typing" over an ephemeral
  `chat-typing` GenosRTC data channel (never the database), auto-clearing after 2s idle
  and on send.
- **"Viewing now" presence** — a post shows which other connected peers are viewing it
  right now, over a `presence` GenosRTC channel; converges via a heartbeat and clears on
  leave. (`services/presence.js`.)
- **1:1 peer-to-peer file transfer** — a 📎 in a DM sends a file straight to the
  recipient over a `file` GenosRTC channel, **targeted at their peerId** (not a
  broadcast, never the database), with a live progress bar on both sides and a download
  link on receipt. The thread shows the peer's connection status and only allows sending
  when both are connected; files over ~1.4 MB are rejected up front (GenosRTC caps a
  channel message at ~100 chunks). (`services/filetransfer.js`, `services/roster.js`.)
- **Display names everywhere** — set a profile name and it replaces the `0x…` address
  across the id-pill, community feed, post/comment bylines, chat and the governance
  roster. Resolved **live** from the signed `user` node (which propagates P2P), not
  denormalised onto each post — so a rename updates everywhere; falls back to the
  abbreviated address. (`services/names.js`.)
- **Polls in search** — field-level `$text` search now also covers polls
  (question + description), alongside communities, posts and people.

### Notes

- New services `names`, `presence`, `roster` and `filetransfer` power the live features;
  all the ephemeral ones ride **GenosRTC data channels**, not the database.
- `rx` (radix prefix index) was evaluated but not adopted — field-level `$text` search
  already covers discovery across communities, posts, polls and people. Audio/video rooms
  were considered but deferred (full-mesh media tops out at a handful of peers without an SFU).

## [0.2.0] — Polish, gamification & hardening

### Added

- **Karma badges** — six derived reward tiers (Spark → Bronze → Silver → Gold →
  Crystal → Legend), drawn as hand-made **animated inline SVGs** (no GIFs, no
  external API, no library — true to "GenosDB is the only dependency"). Shown big
  on the profile with a progress bar to the next tier, and small beside each post
  author. Like karma itself, badges are **derived from signed votes**, never
  stored.
- **Tier-up toast** — a celebratory notification when your karma crosses into a
  higher tier; reactive (watches votes), fires only on an upward crossing.
- **Post editing** — authors can edit their own posts, reusing the create-post
  form (Markdown Write/Preview toggle, optional image replace); an "edited" marker
  is shown.
- **Markdown live preview** — a Write / Preview toggle on the post composer.
- **Author post deletion** — authors can delete their own posts from both the
  community feed and the post detail (previously only community moderators could).
- **Responsive layer** (`responsive.css`) — the top bar, page/detail headers and
  action buttons adapt to phones (verified down to 390 px).
- **Keyboard focus ring** — a single global `:focus-visible` outline on every
  interactive element, suppressed for mouse clicks.

### Changed

- **Build: GenosDB is now bundled the canonical way.** Switched from serving
  GenosDB's whole `dist/` over HTTP to `import { gdb } from "genosdb"` — the bundler
  inlines GenosDB's core into the app bundle, and only its runtime plugins
  (`*.min.js`, loaded via `import.meta.url`) are copied beside the bundle. `dev` and
  `build` now share one bundle-to-disk pipeline (Bun's HMR dev server resolves
  `import.meta.url` to a browser-blocked `file://` path), so dev mirrors production.
- **Design tokens** — every hardcoded colour consolidated into semantic tokens
  (status, role, glow, scrim); the role colours are now a single source shared by
  the top-bar chip and the governance view. Progress bars pass their dynamic value
  as a `--pct` custom property, so the width rule lives in CSS, not an inline style.

### Fixed

- **Vote authenticity (security)** — every tally (post/comment score, poll result,
  karma) now counts a vote **only when the cryptographically-verified signer
  (`owner`) matches the declared `voter`**, and karma additionally ignores
  self-votes. Closes a forgery where one key could inflate a tally with fake voter
  ids. Reputation is unforgeable and independently auditable by any peer.
- **Governance demote-to-guest** — `ensureUserDoc` / `syncPostCount` no longer
  overwrite a role with `guest` on reload before the node has synced from
  OPFS/peers.
- **postCount on delete** — deleting a post now lowers `postCount` (re-derived from
  live posts), so `trusted` correctly demotes to `member` below the threshold.
- **P2P rapid reloads** — `RTCPeerConnection`s are released on `pagehide`, so
  reloading repeatedly no longer hits Chromium's per-process connection cap.

## [0.1.0] — Showcase build

The complete dSocial experience, built from scratch on **GenosDB** in pure
vanilla JavaScript (no framework, no TypeScript), across nine verified phases.

### Added

- **Identity** — BIP39 onboarding (create / recover), WebAuthn passkey protection,
  Security Manager signing.
- **Communities** — public communities; signed memberships (derived counts);
  delegated moderators.
- **Posts & comments** — Markdown posts (sanitised, anti-XSS, zero deps); threaded
  comments; up/down votes with derived scores.
- **Polls** — single / multi-choice, public or invite-only; one signed vote per
  identity; live derived tallies.
- **Karma** — net up/down across the votes on your posts and comments, derived
  (never stored).
- **End-to-end encrypted chat** — 1:1 DMs (RSA-OAEP) and group rooms (AES-256-GCM,
  key shared by invite link or password).
- **Governance** — open, rule-driven RBAC; promotion `guest → member → trusted`
  signed by a superadmin per public rules; auto-demotion when a condition is lost.
- **Moderation** — community-scoped, delegated `delete` (owner + moderators only).
- **Discovery** — field-level `$text` search; derived-stat profiles; base64 images
  (client-side canvas compression); settings; live P2P network page.
- **Zero-trust** — signed operations and node-level ACLs: a peer cannot alter or
  delete another peer's node.
- **Deploy** — `netlify.toml` + repo-linked auto-deploy on push to `main`.

### Stack

- **Bun** (runtime + bundler), vanilla DOM + a tiny `signal()` reactive primitive
  + a History-API router.
- **GenosDB 0.16.0** is the only runtime dependency, imported the canonical way
  (`import { gdb } from "genosdb"`): the bundler inlines its core into the app
  bundle, and its optional plugins (`sm`, `genosrtc`, …) load at runtime via
  `new URL('./*.min.js', import.meta.url)`, copied beside the bundle by
  `copy-genosdb.js`.
