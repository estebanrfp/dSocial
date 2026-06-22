# GOAL — InterPoll-vanilla

Construye **InterPoll-vanilla**: la edición definitiva de InterPoll (red social/foro
P2P con encuestas) sobre **GenosDB**, en **JavaScript VANILLA PURO** — sin ningún
framework (ni Vue, ni Ionic) y **SIN TypeScript** (archivos `.js`, ESM nativo; usa
JSDoc para documentar, nada de tipos TS ni `tsconfig`). Es el showcase de que
GenosDB es la única dependencia que necesita una app social descentralizada.
Consulta tu memoria **"interpoll-genosdb-migration"** para el contexto completo.

## Ubicación y estado
`/Users/estebanrfp/Projects/Deployments/interpoll-vanilla` (repo git privado).
Scaffold ya funcionando y en **JS puro**: Bun (runtime+bundler), `index.html` +
`src/main.js`, `server.js` (bundlea con HMR y sirve GenosDB intacto desde
`/genosdb`), `src/db/gdb.js` (carga el engine), `scripts/copy-genosdb.js`.
`bun run dev` → http://localhost:3000. Verificado: GenosDB inicializa, 0 errores.

## Documentación de GenosDB (consúltala SIEMPRE, no asumas APIs)
- Docs oficiales: `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/docs/`
- Ejemplos:       `/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB/examples/`
- Operadores de query (fuente de verdad): `…/GDB-Project/GenosDB/lib/components/Operators.js`

Antes de usar cualquier API (`db.map/get/put`, `sm`, `acls`, operadores como
`$text`/`$in`, governance…), **léela** en docs/ejemplos/código y verifícala.

> ⚠️ **REGLA CRÍTICA — GenosDB es de SOLO LECTURA.** El repo de GenosDB
> (`/Users/estebanrfp/Projects/Deployments/GDB-Project/GenosDB`) **y** el fork
> (`interpoll-genosdb`) son **referencia de solo lectura**. **NUNCA** los edites,
> escribas, crees/borres archivos ni alteres nada en ellos — ni código, ni docs,
> ni config, ni `dist`. Todo tu trabajo ocurre **exclusivamente** dentro de
> `interpoll-vanilla`. De GenosDB **solo se lee para comprender y aplicar** bien su
> API y comportamiento — **nunca para copiar ni replicar** su código.

## Referencia de features (NO MODIFICAR)
El fork Vue+Ionic en `/Users/estebanrfp/Projects/Deployments/interpoll-genosdb`.
Reproduce **todas** sus secciones. Reutiliza la lógica de sus servicios
(`src/services/*`: poll, community, user, chat, moderationGrants…) portándola a `.js` vanilla.

## Inicialización de GenosDB (config del fork)
El scaffold arranca con `gdb(name, { rtc: true })` mínimo. Para paridad, porta la
config de `interpoll-genosdb/src/services/gdbServices.ts`: Security Manager con
`customRoles` (roles guest→member→trusted + superadmin), `governanceRules`
(ascenso de rol por reglas públicas), `acls: true`, `rtc: true`, y la lista
`SUPER_ADMINS`. Usa un `GDB_NAME` propio para la sala de la edición vanilla.

## Stack y arquitectura (obligatorio)
- Bun para build/run/scripts. GenosDB servido intacto desde `/genosdb`, **nunca bundleado**.
- **Sin frameworks.** UI con **Web Components nativos**; reactividad suscrita a
  `db.map`/`db.get` (GenosDB ya es reactivo) + señales mínimas para estado local.
- **Modular: nada de archivos monolíticos** — un componente/vista/servicio por archivo.
- **Lazy loading** de vistas por sección (`import()` dinámico).
- Router propio mínimo (history API). Coherente, mantenible, **escalable**.

## Diseño (estilo TOTALMENTE NUEVO, de alto impacto)
**NO heredes el look del fork.** Diseña un sistema visual **propio, nuevo,
sofisticado y de alto impacto**: paleta, tipografía, escala de espaciado,
jerarquía, radios, sombras y microinteracciones coherentes y memorables.
Minimalismo fuerte (dark de base), cero ruido. **UX óptima**: flujos claros, sin
fricción, **una sola forma de hacer cada cosa** (sin acciones duplicadas).
**Sin estilos inline**; todo en CSS con variables/tokens. UI y código/comentarios
**en inglés**.

## Features (paridad FUNCIONAL con el fork)
Reproduce **TODAS las opciones** del fork — pero **paridad funcional, no copia
1:1**: elimina las redundancias y el legacy que ya detectamos (botones de acción
duplicados, vistas muertas tipo "Chain Explorer", capas de voto duplicadas,
navegación repetida). Las funciones, sí; el cruft, no.

Identidad SM (onboarding mnemónica BIP39); comunidades (públicas / privadas con
invite-code / cifradas); posts con markdown; encuestas (voto nativo = nodo `vote`
firmado ACL-owned, recuento derivado, un voto por identidad, invite-codes);
comentarios; karma derivado de votos; chat E2E + salas; governance (roles
guest→member→trusted + superadmin con reglas públicas); moderación (ACL delegada:
borrado por owner+mods); búsqueda (`$text` a nivel de campo); perfiles; imágenes
(nodos GenosDB base64); settings; página de red.

**Seguridad (como el fork):** markdown de posts sanitizado (anti-XSS); cifrado
E2E en chat y en comunidades privadas/cifradas; identidad zero-trust (toda
operación firmada y verificada por el Security Manager).

## Cómo trabajar
1. **Primero propón la arquitectura y el plan por fases** (en un único mensaje) y
   luego **procede sin detenerte a esperar confirmación** (pensado para `/goal`
   autónomo; el usuario puede interrumpir si quiere ajustar algo).
2. Construye incremental por fases: núcleo (gdb+SM+identidad+router+shell+design
   system) → comunidades+posts → encuestas+votos → comentarios+karma → chat →
   governance+moderación → búsqueda+perfiles+settings → pulido → despliegue.
3. Commit por fase (mensajes convencionales, **sin Co-Authored-By Claude**).
4. Respeta las reglas globales (ES2022+, async/await, factory functions sobre
   clases, código compacto y legible, JSDoc en funciones públicas).

## Definición de TERMINADO (no termines antes)
No basta con que compile. Arranca `bun run dev` y **prueba en un navegador real**
(con playwright) que **TODAS las opciones** funcionan end-to-end y sin errores de
consola: identidad, comunidades (pública / privada con invite-code / cifrada),
posts, encuestas + voto + recuento, comentarios, karma, chat + salas, governance,
moderación, búsqueda, perfiles, imágenes, settings, red.

Verifica además, abriendo **dos (o más) navegadores con identidades distintas**:
- **Sync P2P**: lo que crea/vota un peer aparece en el otro en vivo.
- **Zero-trust / governance**: un peer **NO** puede borrar ni alterar el contenido
  firmado de otro (la operación se rechaza); el ascenso de rol por governance
  (guest→member→trusted) propaga y persiste entre peers.

El trabajo termina **solo** cuando has comprobado, en el navegador, que **todo**
funciona — incluidos el **P2P multi-navegador** y el **zero-trust**.

## Despliegue (fase FINAL, Netlify)
Solo cuando **todo** esté construido y verificado. Prepara:
- `netlify.toml`: `command = "bun run build"`, `publish = "dist"`, y un redirect
  SPA `/* → /index.html 200`.
- Asegura que `bun run build` deja GenosDB en `dist/genosdb` (el script
  `copy-genosdb.js dist` ya lo hace) y que los assets sirven desde la raíz.
- Comprueba un build de producción local antes de publicar.

La **publicación** (crear/enlazar el sitio en Netlify y el go-live) la aprueba/hace
Esteban — preferentemente repo-linked (auto-deploy en `push`), como el fork. Deja
todo listo para publicar, pero **no publiques de forma autónoma**.

## No hagas
Usar ningún framework/librería de UI; TypeScript; bundlear GenosDB; **escribir,
modificar, crear o borrar archivos en el repo de GenosDB o en el fork** (son de
SOLO lectura); añadir trailer de IA a los commits; **publicar/desplegar de forma
autónoma** sin la aprobación de Esteban.
