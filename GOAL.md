# GOAL --- InterPoll Vanilla

Build **InterPoll Vanilla**: the definitive edition of InterPoll (a
decentralized social network/forum with polls) powered by **GenosDB**,
implemented in **pure Vanilla JavaScript**.

The application must use **no UI frameworks** (no Vue, React, Angular,
Ionic, etc.) and **no TypeScript**. Use native ES modules (`.js` files)
and JSDoc for documentation where appropriate.

The objective is to demonstrate that **GenosDB is the only dependency
required to build a complete decentralized social platform**.

## Project Location

Repository:

`/Users/estebanrfp/Projects/Deployments/interpoll-vanilla`

The project already contains a working scaffold with Bun, `index.html`,
`src/main.js`, `server.js`, `src/db/gdb.js` and
`scripts/copy-genosdb.js`.

Run:

``` bash
bun run dev
```

Default URL:

`http://localhost:3000`

GenosDB initialization is already verified and working.

## GenosDB Documentation (Source of Truth)

Always consult the official implementation before using any API.

-   Docs:
    `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/docs/`
-   Examples:
    `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/examples/`
-   Operators:
    `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/lib/components/Operators.js`

Never assume APIs or behavior.

## Critical Rule --- Read Only

The GenosDB repository and the `interpoll-genosdb` fork are strictly
read-only references.

Never modify, create, delete or overwrite files inside them.

All implementation work must happen only inside `interpoll-vanilla`.

## Functional Reference

Use the Vue/Ionic implementation as the functional reference and achieve
functional parity while improving architecture and removing unnecessary
legacy complexity.

## Technology Stack

-   Bun
-   Native ES Modules
-   Vanilla JavaScript only
-   No TypeScript
-   No UI frameworks
-   No CSS frameworks

Bundle GenosDB the canonical way (`import { gdb } from "genosdb"`): the bundler
inlines its core, and only its runtime plugins (`*.min.js`, loaded by the engine
via `import.meta.url`) are copied beside the output bundle. `dev` and `build`
share one bundle-to-disk pipeline — Bun's HMR dev server resolves `import.meta.url`
to a browser-blocked `file://`, so dev mirrors production.

## Architecture

-   One responsibility per module
-   One component per file
-   One service per file
-   One view per file
-   Native Web Components
-   History API router
-   Dynamic `import()` for lazy loading
-   GenosDB reactivity as the primary reactive system

Favor composition and factory functions.

## Design System

Design the application as a single coherent product.

-   Functional minimalism
-   Clear hierarchy
-   Consistent spacing and typography
-   Predictable navigation
-   Responsive and accessible
-   Dark-first visual identity
-   CSS variables and design tokens
-   No inline styles
-   Reusable components everywhere
-   One obvious interaction pattern per action

Do not copy the reference project's appearance.

## Required Features

-   BIP39 onboarding
-   Security Manager identity
-   Public, private and encrypted communities
-   Invite codes
-   Markdown posts
-   Polls and signed voting
-   Comments
-   Derived karma
-   End-to-end encrypted chat
-   Governance and roles
-   Moderation with ACL delegation
-   Full-text search
-   Profiles
-   Images via GenosDB
-   Settings
-   Network page

## Security

Maintain zero-trust guarantees:

-   Sanitized markdown
-   XSS protection
-   End-to-end encryption
-   Signed operations
-   ACL enforcement
-   Security Manager verification

## Development Process

Proceed autonomously.

Suggested phases:

1.  Core infrastructure
2.  Identity
3.  Router
4.  Design system
5.  Communities
6.  Posts
7.  Polls
8.  Comments
9.  Karma
10. Chat
11. Governance
12. Moderation
13. Search
14. Profiles
15. Settings
16. Polish
17. Production readiness

Use conventional commits without AI attribution.

## Code Standards

-   ES2022+
-   async/await
-   JSDoc
-   Compact readable code
-   Early returns
-   Modern syntax

## Definition of Done

The project is complete only after:

-   Successful execution with `bun run dev`
-   Real browser verification
-   Zero console errors
-   End-to-end validation of every feature
-   Multi-peer synchronization tests
-   Governance propagation tests
-   ACL enforcement tests
-   Zero-trust verification

## Production

Prepare `netlify.toml`, verify `bun run build`, ensure GenosDB's runtime
plugins (`dist/*.min.js`) are emitted beside the bundle, and SPA redirects are
configured.

Deployment requires explicit approval from Esteban.

## Prohibited

-   UI frameworks
-   TypeScript
-   Breaking GenosDB's plugin resolution (its `*.min.js` must ship beside the bundle)
-   Modifying GenosDB
-   Modifying the reference implementation
-   Automatic deployment
-   Duplicate UX patterns
