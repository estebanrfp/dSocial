# Changelog

All notable changes to **InterPoll (vanilla)** are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/). The app runs on **GenosDB 0.16.0**,
its only runtime dependency — bundled into the app, with its runtime plugins copied beside the bundle.

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

The complete InterPoll experience, rebuilt from scratch on **GenosDB** in pure
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
