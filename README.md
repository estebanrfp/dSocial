# InterPoll (vanilla)

A peer-to-peer polling and forum app built on **[GenosDB](https://github.com/estebanrfp/gdb)** — vanilla JavaScript, no UI framework. Every action is a signed node; data syncs P2P over WebRTC; there is no backend.

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
bun run build    # → dist/
```

## Author

Esteban Fuster Pozzi (@estebanrfp) - Full Stack JavaScript Developer
