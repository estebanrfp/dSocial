# InterPoll (vanilla)

A peer-to-peer polling and forum app built on **[GenosDB](https://github.com/estebanrfp/gdb)** — vanilla JavaScript, no UI framework. Every action is a signed node; data syncs P2P over WebRTC; there is no backend.

## Features

- **Communities, posts & comments** — Reddit-style feeds; Markdown posts (sanitised, no deps); threaded comments. Up/down votes derive scores and **karma** from signed vote nodes — no peer mutates a shared counter.
- **Polls** — single/multi-choice, public or invite-only; one deterministic vote per identity; live tallies across peers.
- **End-to-end encrypted chat** — 1:1 DMs (RSA-OAEP, encrypted for both parties) and group **rooms** (AES-256-GCM, key shared via invite link or password). The synced node *is* the delivery.
- **Governance (RBAC)** — open, rule-driven promotion (`guest → member → trusted`); a superadmin signs each role change per public rules. See [`src/db/gdb.js`](src/db/gdb.js).
- **Moderation** — delegated, cooperative delete: an author grants `delete` on their node to the community owner + moderators, scoped to that community. No global censor.
- **Zero-trust** — a peer cannot alter or delete another peer's signed content; the operation is rejected.
- **Profiles, search, images, network** — derived-stat profiles with inline editing; field-level `$text` search; base64 images stored as GenosDB nodes (client-side canvas compression); a live P2P peer view.

## Stack

- **Runtime / bundler:** [Bun](https://bun.sh)
- **Data + identity + P2P:** GenosDB (the single runtime dependency)
- **UI:** vanilla DOM + Web Components, reactive over `db.map`
- **No** framework, no virtual DOM, no central server.

## Develop

```sh
bun install
bun run dev      # http://localhost:3000
```

`dev`/`build` first copy GenosDB's dist into `public/genosdb` (served intact, never bundled) so the engine's runtime-loaded plugins resolve.

## Build

```sh
bun run build    # → dist/ (minified, GenosDB copied into dist/genosdb)
```

## Deploy (Netlify)

[`netlify.toml`](netlify.toml) is preconfigured: `bun run build` → publish `dist`, with an SPA redirect (`/* → /index.html`). Link the repo on Netlify for auto-deploy on push.

> **Superadmins** live in [`src/db/gdb.js`](src/db/gdb.js). For this public showcase a throwaway **demo superadmin** (public seed) is included alongside the operator address so the governance engine can run for any visitor — drop it for a fully private network.

## Author

Esteban Fuster Pozzi (@estebanrfp) - Full Stack JavaScript Developer
