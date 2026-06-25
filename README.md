# dSocial

> *A voice for everyone — no servers, no gatekeepers, signed by default.*

> ### ▶️ [**Live demo**](https://dsocial-genosdb.netlify.app)
> Try it now: **https://dsocial-genosdb.netlify.app** — a running,
> serverless build. Open it in **two browsers** to watch communities, polls and
> votes sync peer-to-peer in real time, chat end-to-end encrypted, and see typing,
> "viewing now" presence and 1:1 file transfer happen live — no backend in between.

> ### 🛰️ A from-scratch GenosDB showcase
> dSocial is a **decentralised social network — communities, posts, polls, votes and
> encrypted chat — built from scratch in vanilla JavaScript** (no framework, no
> TypeScript) on **[GenosDB](https://github.com/estebanrfp/gdb)**, showing how an
> entire social app runs on a single peer-to-peer database: **one dependency, zero
> servers, signed by default.**

---

## What is dSocial?

dSocial is a **free, open, decentralised social network** — a place where communities vote, post, comment, and chat without any single company in control.

When you vote, publish a post, or send a message, your activity is stored locally first and then synced peer-to-peer across the network. No central server owns your community history. Every action is cryptographically signed by an identity that lives only on your device, and posts replicate across peers so they are harder to suppress or quietly erase.

**Anyone can create a community, earn trust under public rules, and moderate their own space** — with no algorithm deciding what you see and no central team that can silently remove your post.

---

## Why it matters

Traditional online communities share one weakness: **one server, one point of control**. The company that runs it can delete a poll, hide a post, alter results, or go offline.

dSocial takes a different approach, powered by **GenosDB** — a peer-to-peer graph database with built-in cryptographic identity:

- **No single owner.** Data lives on every participant's device and syncs directly peer-to-peer. There is no backend to capture or shut down.
- **Your vote, signed by you.** Every action is signed by an identity that lives only on your device. No peer can forge a vote or post in your name.
- **Owned by you, not just signed by you.** Your content is yours to remove — no peer can delete your post, vote, message or profile; only you, or a moderator a community owner delegates to.
- **Earned trust.** Roles aren't handed out: you climb `guest → member → trusted` by participating, under public rules every peer can verify.
- **Reputation you can't fake.** Karma — and the badges it unlocks — are *derived* from the signed votes of others, never a stored number. There's nothing to tamper with: any peer can recompute it from the same signed nodes.
- **Private chat.** 1:1 messages and group rooms are end-to-end encrypted in your browser; peers only ever relay ciphertext.
- **Live by default.** Every post, vote, comment and membership propagates peer-to-peer and updates in real time — no refresh, no polling. Typing, "viewing now" presence and direct 1:1 file transfers ride the same P2P link as ephemeral signals, never written to the database.

---

## Key features

| Feature | What it means for you |
|---|---|
| **Cryptographically signed actions** | Every vote, post, comment and message is signed by your device identity and verified by peers. Forgery is impossible without your key. |
| **Communities, posts & threaded comments** | Reddit-style feeds with Markdown posts (sanitised, zero dependencies) and votable threaded comments. |
| **Derived tallies & karma** | Scores, poll tallies and user karma are *derived* by aggregating signed vote nodes — no shared counter to race on, no number a peer can fake. A vote only counts when its verified signer matches the declared voter. |
| **Reputation badges** | Karma unlocks six animated tiers — Spark → Bronze → Silver → Gold → Crystal → Legend — hand-drawn as inline SVG (no GIFs, no API, no library). Derived from the same signed votes, so they're unforgeable *and* recomputable by any peer; a toast celebrates each tier-up. |
| **Polls, public or invite-only** | Single/multi-choice polls; one deterministic vote per identity; single-use invite codes for private polls. |
| **End-to-end encrypted chat** | 1:1 DMs (RSA-OAEP) and group rooms (AES-256-GCM) — **public** (discoverable directory, one-click join) or **private** (invite-only, key shared by invite link or password). The room owner can delete a room for everyone; the synced node *is* the delivery. |
| **Earned trust (governance)** | Climb `guest → member → trusted` under public `governanceRules`; a superadmin only *signs* the promotions the rules dictate. |
| **Community-scoped moderation** | A community's creator (and moderators they delegate to) can remove content in *that* community only — via delegated `delete` grants, never a platform-wide censor. |
| **Yours to delete — and only yours** | Every node is owned by your device identity. No other peer can delete or overwrite it; the operation is rejected. |
| **Passkey or recovery phrase** | Protect your identity with a WebAuthn passkey or a 12-word BIP39 recovery phrase. |
| **Real-time presence & typing** | See who's *viewing a post now* and *who's typing* in a DM — ephemeral signals multiplexed over the shared GenosRTC channel, never stored. |
| **1:1 file transfer** | Send a file straight to another connected peer over a GenosRTC data channel — targeted (not broadcast), with a live progress bar on both sides; nothing touches the database. |
| **Display names, not addresses** | Set a profile name and it shows everywhere — feed, posts, chat — instead of your `0x…` address; resolved live from your signed profile, which propagates P2P. |
| **Live reactive feeds** | One app-wide `db.map` mirrors the whole graph into memory; feeds, scores and tallies derive from it synchronously and stay live — new posts, deletes and votes from any peer, no reload. GenosDB is client-side, so reads are local and instant. |
| **Images, search, live network** | Base64 images stored as nodes (client-side canvas compression); field-level `$text` search over communities, posts, polls and people; a live view of connected P2P peers. |

---

## How it works (plain language)

dSocial runs entirely on **GenosDB** — there are no servers to operate:

**1. Your identity (the key).** On first use you generate an identity that lives only on your device, protected by a passkey or recovery phrase. It signs every action automatically; peers verify those signatures, so nobody can act as you.

**2. The graph (the data).** Communities, posts, comments, polls, votes, messages and profiles are stored as nodes in a local graph (persisted to your browser's OPFS storage). Each vote is its own signed node, so concurrent votes never overwrite each other — tallies are *derived*, not mutated.

**3. The mesh (the sync).** GenosDB connects peers directly over **GenosRTC** — its peer-to-peer networking layer, built on WebRTC — using decentralised Nostr relays only for discovery (signaling), never for your data. Changes propagate peer-to-peer in real time, and across your own browser tabs instantly: a single app-wide `db.map` mirrors the graph into memory, so every view reacts live with no per-component subscriptions. The same P2P link also carries **ephemeral real-time signals** — typing, "viewing now" presence and direct 1:1 file transfers — multiplexed over a single GenosRTC data channel, kept entirely separate from the stored graph.

**4. Roles & moderation (earned, not granted).** New identities start as guests and climb to member, then trusted, by participating — under public rules every peer can verify. Moderation is per-community via node-level ACLs: a community owner and their delegated moderators can remove content in that community only.

```
            ┌───────────────────────── Your browser ──────────────────────────┐
            │                                                                 │
            │   views/ ───────────────►   db.map()   ◄──── reactive updates   │
            │   (vanilla DOM)             subscriptions                       │
            │      │                            ▲                             │
            │      ▼                            │                             │
            │   services/ ─────────►  GenosDB  ─┴─►  Graph store · OPFS       │
            │   posts·polls·chat       │ signs                                │
            │   roles·moderation       │ every action                         │
            │                          ▼                                      │
            │            Security Manager · your key (BIP39 / passkey)        │
            └─────────────────────────────┬───────────────────────────────────┘
                                          │ signed delta sync over GenosRTC (WebRTC)
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                   ┌─────────────────┐         ┌─────────────────┐
                   │   Peer browser  │   ···   │   Peer browser  │
                   └─────────────────┘         └─────────────────┘

      Nostr relays ···· signaling / peer discovery only · never your data ····►
```

> **In short:** your communities, posts, votes and messages exist on your device and on your peers' devices at once. Erasing them would mean erasing every copy simultaneously — sooner or later, a peer with a copy reconnects and reseeds the network.

---

## Honest about the limits

dSocial is designed to be **harder to censor and tamper with than a single-server platform** — not impossible:

- Data survives as long as **at least one honest peer** keeps a copy and later reconnects.
- A signature **cannot be forged** without your device key; peers reject any unsigned or invalidly-signed operation.
- Every tally (scores, poll results, karma) counts a vote **only when the verified signer matches the declared voter**, and karma ignores self-votes — so no key can inflate a number with fabricated voters.
- One-identity-one-vote is enforced per signing identity (plus single-use invite codes for private polls) — this **raises the cost** of duplicate voting but is not a one-human-one-vote mathematical guarantee.
- Encrypted chat uses **AES-256-GCM / RSA-OAEP** in the browser. The encryption is strong, but if you lose your key there is no recovery.

---

## Quick start

dSocial is a pure client app — **no backend, no relay server to run.**

```sh
bun install
bun run dev      # http://localhost:3000
```

### Commands

```sh
bun run dev      # Bundle (watched) + serve from dist/  →  http://localhost:3000
bun run build    # Production build → dist/ (minified)
bun run serve    # Serve an existing build locally
```

> **How GenosDB is bundled.** The app imports GenosDB the canonical way — `import { gdb } from "genosdb"` — so the bundler **inlines GenosDB's core straight into the app bundle**. GenosDB then loads its *optional* plugins (`sm`, `genosrtc`, `geo`, …) at runtime via `new URL('./*.min.js', import.meta.url)`, resolved next to the output bundle, and **only the plugins in use are fetched** (this build never pulls `ai`, `nlq` or `geo`). Bun doesn't emit those `.min.js`, so [`scripts/copy-genosdb.js`](scripts/copy-genosdb.js) copies them to the build root beside the bundle — the *"copy the assets after the build"* step from GenosDB's [bundler guide](https://github.com/estebanrfp/gdb/blob/main/docs/bundler-configuration.md).
>
> `dev` and `build` share the **same bundle-to-disk pipeline** (Bun's HMR dev server resolves `import.meta.url` to a `file://` path the browser blocks, so dev mirrors production rather than diverging from it). The output is plain **static hosting, not a backend**: *serverless* here means no application server ever processes your data — it all runs peer-to-peer in the browser.

## Deploy (Netlify)

[`netlify.toml`](netlify.toml) drives the build: `bun run build` → publish `dist`, with an SPA redirect (`/* → /index.html`). The repo is linked to Netlify, so **every push to `main` auto-deploys** to production.

> **Superadmins** live in [`src/db/gdb.js`](src/db/gdb.js). For this public showcase a throwaway **demo superadmin** (public seed) is included alongside the operator address so the governance engine can run for any visitor — drop it for a fully private network.

---

## Technical overview

### Stack

Vanilla DOM + a tiny `signal()` primitive and a history-API router on the front end; **GenosDB 0.16.0** for data, identity and P2P sync. Built and served with **[Bun](https://bun.sh)**. Installing GenosDB pulls **zero transitive dependencies** — it is the only one.

### Data model

Everything is a signed GenosDB node, mirrored into memory by **one app-wide `db.map`** ([`db/store.js`](src/db/store.js)) and read synchronously from there:

| Node type | Purpose |
|---|---|
| `community`, `membership` | Communities and signed memberships (member count derived) |
| `post`, `postVote` | Posts and their up/down votes (score derived) |
| `comment`, `commentVote` | Threaded comments and their votes (score + karma derived) |
| `poll`, `vote` | A poll and its one-per-identity signed votes (tally derived) |
| `dm`, `chatKey` | E2E direct messages (RSA-OAEP) + published public keys |
| `chatRoom`, `chatMessage`, `roomMember` | Encrypted group rooms (AES-256-GCM) + derived membership |
| `user` | Profile keyed by address; `user:<address>` also holds governance standing (role, `postCount`) |
| `image` | Canvas-compressed images stored as base64 nodes |

### Key services

| File | Responsibility |
|---|---|
| [`db/gdb.js`](src/db/gdb.js) | The single GenosDB instance — SM config, RBAC roles + `governanceRules`, ACLs |
| [`db/store.js`](src/db/store.js) | The one app-wide reactive `db.map` — an in-memory mirror of the graph every service reads and subscribes through (one `db.map`, not one per view) |
| [`services/identity.js`](src/services/identity.js) | Onboarding (create/recover BIP39, passkey), profiles, derived stats + karma |
| [`services/roles.js`](src/services/roles.js) | Governance standing (the `user:<address>` node), live role subscription |
| [`services/communities.js`](src/services/communities.js) | Communities, derived membership, moderators |
| [`services/posts.js`](src/services/posts.js) · [`comments.js`](src/services/comments.js) | Posts and threaded comments with signed voting; a fully reactive feed (new posts, deletes, live scores) derived from the store |
| [`services/polls.js`](src/services/polls.js) | Polls, one-per-identity votes, derived tallies, invite codes |
| [`services/chat.js`](src/services/chat.js) · [`chatrooms.js`](src/services/chatrooms.js) | E2E direct messages and encrypted group rooms — hybrid public (discoverable) / private (invite-only), owner-deletable |
| [`services/moderation.js`](src/services/moderation.js) | Delegated, community-scoped `delete` grants |
| [`services/search.js`](src/services/search.js) | Field-level `$text` search over communities, posts, polls and people |
| [`services/images.js`](src/services/images.js) | Canvas compression → base64 image nodes |
| [`services/badges.js`](src/services/badges.js) · [`tier-watch.js`](src/services/tier-watch.js) | Karma reward tiers (animated inline-SVG badges) + reactive tier-up toast |
| [`services/names.js`](src/services/names.js) | Live display-name cache from `user` nodes → names instead of `0x…` everywhere |
| [`services/p2p.js`](src/services/p2p.js) | The one GenosRTC `app` channel, multiplexed by message `kind`: roster (address↔peerId) + 1:1 file transfer + a generic `broadcast`/`onSignal` transport that typing & presence ride on |
| [`services/presence.js`](src/services/presence.js) | "Viewing now" presence — a `presence` signal on the shared channel |
| [`services/net.js`](src/services/net.js) | Live P2P peer tracking |

### How a vote works

1. You select an option; the app writes a **signed `vote` node** keyed `pollId:yourAddress` — one vote per identity, re-voting updates it in place.
2. The Security Manager signs the operation automatically, and peers verify it on receipt.
3. The poll's tally is **derived** by aggregating its vote nodes — counting only those whose verified signer matches the voter — so there are no shared counters to race on and no forged voters to inflate it.
4. The node syncs to peers in real time over GenosRTC (WebRTC) — and to your other tabs instantly.

### Project layout

```
src/
├─ db/         gdb.js — the single GenosDB instance · store.js — the one app-wide reactive db.map · schema.js — node types + id schemes
├─ state/      signal.js — reactive primitive · session.js — identity signals
├─ router/     router.js — history-API SPA router, lazy-loaded views
├─ ui/         base.js — html/esc helpers · shell.js — top bar · toast.js · copy.js
├─ services/   data + identity logic + live P2P (typing · presence · file transfer — one channel)
├─ views/      page modules: async (params) => HTMLElement
├─ utils/      markdown · format · encryption (AES) · keystore (IndexedDB)
└─ styles/     design tokens + per-feature CSS
```

---

## Author

Esteban Fuster Pozzi (@estebanrfp) - Full Stack JavaScript Developer
