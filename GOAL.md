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
**NO modifiques** el proyecto GenosDB ni el fork; solo léelos como referencia.

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

## Diseño
Minimalismo **mucho más fuerte y atractivo** que el fork. Dark, tokens CSS propios
(reaprovecha la paleta indigo/glass del fork). **Sin estilos inline**; todo en CSS
con variables. UI y código/comentarios **en inglés**.

## Features (paridad con el fork)
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
   governance+moderación → búsqueda+perfiles+settings → pulido.
3. Commit por fase (mensajes convencionales, **sin Co-Authored-By Claude**).
4. Respeta las reglas globales (ES2022+, async/await, factory functions sobre
   clases, código compacto y legible, JSDoc en funciones públicas).

## Definición de TERMINADO (no termines antes)
No basta con que compile. Arranca `bun run dev` y **prueba en un navegador real**
(con playwright) que **cada sección** funciona end-to-end y sin errores de consola:
identidad, crear/leer comunidades, posts, encuestas + voto + recuento, comentarios,
chat, governance, moderación, búsqueda, perfiles, settings. Verifica además el
**sync P2P** abriendo **dos contextos de navegador** (dos identidades) y comprobando
que los datos propagan entre ellos. El trabajo termina **solo** cuando has
comprobado que todo funciona.

## No hagas
Usar ningún framework/librería de UI; TypeScript; bundlear GenosDB; tocar el fork
o el repo GenosDB; añadir trailer de IA a los commits.
