# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

"Mis Cuentas": mini app personal de control de ingresos y gastos, pensada para añadirse a la pantalla de inicio del iPhone. El usuario (Josema) habla español y no es programador: explica los cambios en lenguaje sencillo, pregúntale y aconséjale antes de decisiones de diseño o funcionalidad. Se construye poco a poco.

- Publicada en GitHub Pages: https://josemaaafc13.github.io/mis-cuentas/ (repo público `josemaaafc13/mis-cuentas`, rama `main`, raíz `/`).
- Publicar un cambio = `git commit` + `git push`; Pages republica en 1–2 min.

## Comandos

- Probar en local (si Playwright ve 585 px de ancho es el zoom guardado para 127.0.0.1: usa `localhost`): `python3 -m http.server 8765 --bind 127.0.0.1` y abrir http://127.0.0.1:8765 (el service worker no se registra con `file://`; Playwright también bloquea `file://`).
- Revisión de diseño: `~/.claude/skills/impeccable/scripts/impeccable detect index.html`. Los dos avisos `low-contrast` de `#4ade80` y `#ff6b61` son falsos positivos (colores solo de modo oscuro sobre `#0E1E2C`).
- Regenerar iconos: no hay script en el repo; se generaron con Pillow (degradado celeste diagonal + tarjeta de cristal + "€" en SF Rounded) a 180/192/512 px.

## Arquitectura

Todo es estático y sin dependencias ni build, para que funcione sin conexión.

- `index.html` contiene CSS, HTML y JS juntos.
  - Datos: `localStorage` clave `miscuentas.movs.v1`, array de `{id, type:'in'|'out', amount, cat?, note, date(ISO), rec?}`. `cat` solo en gastos; `rec` = id del fijo que lo creó.
  - `miscuentas.settings.v1` = `{budget, catBudgets:{catId:n}, lastBackup}`; `miscuentas.recurring.v1` = `[{id, type, amount, cat?, note, day, lastRun:'YYYY-MM', active}]`. `runRecurring()` apunta los meses pendientes al abrir y en `visibilitychange`.
  - Copia: `exportBackup()` → JSON `{app:'mis-cuentas', version:1, movs, settings, recurring}` por `navigator.share` (menú Compartir del iPhone) o descarga; importar valida (`validMov`) y se puede deshacer (`toast(msg, undoFn)`).
  - `openGrow(panel, src, radio, onOpen)` / `closeGrow()`: un panel `.zoom` crece desde su origen con clip-path (Resumen → categorías, ⚙ → Ajustes).
  - `openForm(type, cat, editing)`: crear o editar; fecha rápida Hoy/Ayer/Otro día (`<input type=date>` + `showPicker`), tira para cambiar categoría, interruptor «Repetir cada mes» (solo al crear). `formatAmountInput(el)` da formato de miles a cualquier campo de importe.
  - Presupuesto: barra en la tarjeta del saldo (`renderBudget`), barras gasto/límite en el panel (vista Mes) y aviso al cruzar 80 % / 100 % (`budgetAlert`). Si la clave no existe se cargan 6 movimientos de ejemplo (desaparecen al guardar el primero real). Si cambias el formato, sube la versión de la clave y migra.
  - `CATS` define las categorías de gasto (id, nombre, emoji, color). `FALLBACK` ("Otros") solo se usa para pintar datos con categorías desconocidas; el usuario pidió quitar "Otros" del selector.
  - `render()` repinta todo: saldo, totales del mes, gráfica (`drawChart`) y lista agrupada por día con total diario. La entrada en cascada solo ocurre en la primera carga o para el movimiento recién añadido (`firstRender`/`justAdded`), para que no parpadee.
  - Las hojas inferiores (`openSheet`/`closeSheet`) se reutilizan para el formulario de ingreso, el de gasto y el detalle/eliminar (con "Deshacer"). `openForm(type, preselectedCat)`.
  - Carrusel Saldo ↔ Resumen (IIFE del `#pager`): sigue al dedo, proyecta el impulso con `project()` y se puede agarrar a mitad de animación (lee la posición real con `DOMMatrix`). Variable global `page`.
  - Gráfica: `aggregateByMonth(movs, 6)` + `smoothPath` (Catmull-Rom con puntos de control limitados para que la curva no baje de 0). SVG a mano, sin librerías. `animateChart` la dibuja con `stroke-dashoffset`.
  - Burbujas de categoría (`openCluster`/`closeCluster`): abanico compacto sobre el +, todas a la vez (sin escalonado, lo pidió el usuario). `layoutCluster()` trata cada burbuja como círculo (r 27) + pastilla del nombre medida, coloca cada anillo pegando una burbuja a la siguiente (menor giro sin choque, paso grueso y luego fino) y centra el grupo arriba; prueba varias combinaciones de anillos (3·4·4…) y elige la más baja. Se cachea por ancho (`layoutFor`) y se precalcula en `requestIdleCallback`. Al abrir, cada burbuja se endereza desde un giro (`folded`) como un abanico. WAAPI desde el estado actual (`presentState`).
  - `render(tone)` → `countTo(total, tone)`: con `'in'`/`'out'` el saldo lleva `.counting-in` (verde) o `.counting-out` (rojo) mientras cuenta. Al abrir un formulario se sube arriba y se vuelve a la página 0 (`goPage`, expuesto por el IIFE del carrusel); al guardar, `render(type)` se lanza tras ~260 ms para que el conteo se vea con la hoja ya bajada.
- `sw.js`: red primero y caché como respaldo. **Sube `VERSION` en `sw.js` en cada publicación** y añade a `FILES` cualquier archivo nuevo.
- `manifest.webmanifest` + `apple-touch-icon.png`: instalación en pantalla de inicio.

## Diseño (decidido con el usuario)

- Estilo Apple (skill `apple-design`): respuesta al pulsar, hojas que se cierran arrastrando, materiales translúcidos, `prefers-reduced-motion` respetado.
- Azul celeste predominante. La tarjeta de saldo es de "cristal celeste": translúcida con desenfoque sobre manchas de color animadas (`.blob`), texto azul marino.
- Ingresos en verde, gastos en rojo (tonos oscurecidos `--green-text`/`--red-text` para contraste AA).
- Botón "+" central que despliega Ingreso / Gasto. Ingreso: cantidad + motivo opcional. Gasto: abre las burbujas de categoría alrededor del +; al tocar una se abre una hoja tan simple como la de ingreso (solo una pastilla con la categoría, sin cuadrícula de categorías).
- Fondo vivo: manchas (`.bg i`) hechas con degradados radiales (no `filter: blur`, por batería) que flotan despacio por toda la pantalla.
- Cada movimiento es su propia burbuja de cristal; los días van como etiqueta encima con su total.
- Estilo burbuja común (`.bub` + `--c`, `.pill` para nombres): categorías, iconos de movimientos (fila tintada de su color), botones Ingreso/Gasto del +, hojas (burbuja grande + cristal tintado vía `openSheet(html, type, color)`) y gráfica. Todo debe seguir esa misma onda.
- La cantidad se formatea al escribir con punto de miles (1.234,56); un "." tecleado cuenta como coma decimal.
- Transparencia alta en todo (tarjeta ~.24, movimientos ~.32, hojas ~.4→.2): el usuario la pidió.
- Al añadir, el saldo cuenta despacio (1,8 s, expo-out) en verde/rojo y la cantidad (`#delta`, `floatDelta`) aparece junto al saldo y sube flotando.
- Tocar la tarjeta Resumen abre el panel `#zoom` "Gastos por categoría": crece desde la tarjeta con `clip-path: inset()` (no deforma) + escala del contenido; se cierra por el mismo camino. Gráfica de burbujas por tamaño (`packBubbles`: área ∝ gasto, la mayor en el centro y las demás en el hueco libre más cercano; tocar una muestra su importe y %), lista con barras (el anillo no le convenció), selector Mes/3/6/Año y flechas para ir a periodos anteriores (`zSpan`, `zEnd`). Three.js se descartó (peso y batería); el usuario eligió el anillo.
- Hojas inferiores (detalle y añadir) en "liquid glass": degradado translúcido + `backdrop-filter` fuerte, borde iluminado, reflejo `::before`, campos/botones de cristal anidado (tokens `--lg-*`). Velo más ligero con hoja abierta. Sólidas con `prefers-reduced-transparency`.
- Segunda tarjeta "Resumen" (deslizar a la izquierda): ahorro neto y gráfica de líneas suaves de ingresos/gastos de los últimos 6 meses.
- Movimiento: recetas de la skill HyperFrames (center-outward-expansion, press-release-spring, svg-path-draw, waterfall-entry) llevadas a WAAPI/CSS, sin GSAP, para que funcione sin conexión. Solo `transform`/`opacity`.
- Categorías: Ocio, Comida, Complementos, Salud, Coche, Hogar, Suscripciones, Ropa, Transporte, Viajes, Regalos.

## v9: efectivo/tarjeta, buscador, icono e intro

- Dos cuentas: `acc:'card'|'cash'` en movimientos y fijos (sin `acc` = tarjeta). `settings.opening` = saldo inicial por cuenta (se pregunta una vez con `askOpening()` si hay datos; Ajustes → Saldos actuales lo recalcula), `settings.face` = cara visible, `settings.lastAcc`. `accBalance(a)`, `accMonth(a)`.
- La tarjeta del saldo muestra la cuenta de la cara visible + "Total". Tocarla cambia de cara con `switchFace()` (v10, elegido por el usuario en lugar del giro 3D de Three.js, que se quitó junto con `vendor/`): la tarjeta no se mueve, los colores azul/verde se funden por CSS (`.card-wrap.cash`), un brillo `.sheen` la cruza y el saldo rueda dígito a dígito (`rollNumber`, odómetro con columnas `.odo`; `rollingNum` impide que `countTo` lo pise). Recetas HyperFrames theme-crossfade-morph + vertical-spring-ticker en WAAPI. Interrumpible; reduced-motion = sin rodar.
- El Resumen (gráfica, ahorro) y el panel de categorías siguen a la cara visible (`curFace()`), con tono verde en efectivo. Presupuesto también por cuenta (`settings.accBudgets`), que manda sobre el global en la barra de la tarjeta.
- Al añadir/editar: burbujas 💳/💵 (`#accs`); por defecto la cara visible; al guardar la tarjeta pasa a esa cuenta.
- Buscador tipo Safari (`#q`) + filtros (`F`: tipo, cuenta, categorías, periodo) que solo afectan a la lista (`renderList`, `passFilter`), con resumen "N resultados · total".
- Icono: tarjeta de cristal delante de billete verde sobre azul (generado con Pillow, `make_icon2.py` en el scratchpad de la sesión).
- Intro (`playIntro`): solo al cargar la página (abrir la app desde cero), no al volver de segundo plano. Burbujas → icono → se expande a la tarjeta. Se salta tocando; `?nointro` la desactiva para pruebas.

## v11: pagos de Apple Pay

- Una app web no puede leer Wallet ni escribir en el almacenamiento de la app de Inicio desde un atajo. Solución: automatización «Transacción» de Atajos (iOS 17+) que añade una línea `Importe;Comercio` (formato simplificado en v12 porque al usuario le costaba montar el JSON; también se acepta JSON con fecha) a `Atajos/mis-cuentas-pagos.txt`. Sin fecha, la app usa la de la importación y deduplica por número de línea (el archivo solo crece). Guía paso a paso en ⚙ → Pagos de Apple Pay → «Cómo configurarlo». Plan B (v13): el atajo usa «Añadir a la nota» (nota «Mis Cuentas pagos») y en la app ⚙ → «Pegar pagos» (`reviewPays`) se pega la nota entera; los ya importados no se repiten.
- ⚙ → «Importar pagos» lee ese archivo (`parsePayLines`, `parseMoney` acepta «12,50 €», «40.00», «1.234,56 €»), descarta duplicados (`settings.payImported`, claves `payKey`) y abre la bandeja (`openPayTray`): categoría sugerida por el comercio (`GUESS`/`guessCat`), cambiable; ✓/✕ por fila o «Añadir todos» (gastos en 💳 Tarjeta, conteo en rojo, aviso de presupuesto).

## v14: buzón automático de pagos (100 % automático)

- `buzon/` = Cloudflare Worker `mis-cuentas-buzon` (cuenta Cloudflare del usuario, `npx wrangler deploy` desde esa carpeta; KV `PAYS`, id en `wrangler.toml`). URL: https://mis-cuentas-buzon.buzon.workers.dev. Endpoints con `?k=<clave 32 hex>`: `POST /pay` (texto, JSON `{l}` o formulario; lo usa el atajo), `GET /pays`, `POST /ack` (borra). CORS solo para github.io y localhost:8765. Caducan a los 90 días; máximo 300 pendientes por clave.
- App: ⚙ → Pagos de Apple Pay → «Recogida automática» (`settings.inboxOn`, clave `settings.inboxKey` generada en el móvil) y «Copiar enlace para el atajo». `pullInbox()` al abrir (tras la intro) y en `visibilitychange`: añade los pagos solos (categoría `guessCat`, 💳 Tarjeta, conteo en rojo) con Deshacer, y confirma (`/ack`). Dedupe por `inbox|id` en `settings.payImported`.
- Atajo: Transacción → Texto «Importe;Comercio» → Obtener contenido de URL (enlace copiado, POST, cuerpo Archivo = Texto) → notificación opcional. El SW ignora peticiones a otros orígenes (no cachea el buzón).

## Pendiente (recordárselo al usuario)

- Notificaciones de los fijos: opciones dadas — Calendario del iPhone (.ics, recomendado, sin servidor), Web Push real (servidor, iOS 16.4+), o aviso dentro de la app.
- Bloqueo con Face ID (WebAuthn/passkey como puerta).
- Mover dinero entre cuentas (cajero: tarjeta → efectivo) sin contar como gasto/ingreso. Recomendado como siguiente.
- Dos puntitos azul/verde bajo la tarjeta del saldo para indicar las dos caras.
- Aviso de efectivo bajo.
- (Hecho en v11) Pagos de Apple Pay: ver abajo. Open Banking (ingresos, Bizum) queda como posible ampliación con servidor.

## Hecho en v7

Ajustes (⚙ en lugar de la "J", con punto naranja si no hay copia o tiene más de 30 días), copia de seguridad, editar y elegir fecha, presupuesto total y por categoría, fijos automáticos.

## v15: cara «Total»
- `settings.face` ∈ `'all' | 'card' | 'cash'`; ciclo `FACES = ['all','card','cash']`; cada arranque pone `face='all'`.
- Helpers: `faceInfo(f)` (ACCS o `ACC_ALL` 💰 #14B8A6), `faceBalance`, `faceMonth`, `inFace(m,f)`.
- Piel aurora `.card-wrap.all` / `.zoom.all`; puntitos `#faceDots` (scaleX, sin animar width).
- En Total: `#accTotal` = desglose 💳/💵, gráfica y panel suman ambas, presupuesto = global.
- Añadir desde Total: cuenta por defecto = `lastAcc`, la cara se queda en Total.

## v16: piel de Total
- Verde azulado profundo #0E4F5C→#127A70 en `.card::before` (fundido por opacidad), brillos #6DD3FA (sup-izq) y #7EF0B4 (inf-der); blobs apagados.
- Texto claro en Total; conteo/delta/gráfica en #7EF0B4 / #FFA8A2. `.zoom.all` con tinte #127A70.

## v17: para todos (tutorial, mover dinero, Face ID, buzón privado)
- Mismo enlace para cualquiera: cada móvil guarda sus datos en su `localStorage`. Ya no hay datos de ejemplo: `load()` devuelve `[]`.
- Mover dinero: movimiento `{type:'tr', amount, from, to, note, date}` (sin `acc`). `delta(m, a)` / `accSum(a)` calculan el saldo por cuenta; `signed(tr)=0`, así que en Total, gráfica, mes y panel no cuenta. `inFace` incluye las transferencias de esa cuenta. Botón «⇄ Mover» en el menú del + (`openTransfer`), ⇄ invierte el sentido con FLIP + muelle. `cleanMov` acepta `tr`. Filtro «🔄 Movimientos». Fecha rápida compartida: `DATES_HTML` + `bindDates()`.
- Bienvenida (`showWelcome`, solo si no hay `miscuentas.movs.v1` y no `settings.welcomed`): 2 páginas con scroll-snap (la 2.ª solo fuera de modo standalone) → `askOpening(true)` → tutorial.
- Tutorial (`startTour`, `TOUR`): velo con agujero (`.coach-hole`, box-shadow 200vmax) que viaja con WAAPI desde su posición actual; 4 `.coach-block` alrededor bloquean el resto. Cada paso avanza al hacer la acción real (`done`), `back` vuelve al ＋ si se cierra a medias. ⚙ → Ayuda → «Ver tutorial».
- Buzón privado: el Worker solo acepta claves del secreto `ALLOWED_KEYS` (`npx wrangler secret put ALLOWED_KEYS`, nunca en el repo); al resto responde 403 y la app apaga la recogida (`inboxPrivate`).

## v18: Ajustes ordenados
- Face ID quitado del todo (el usuario no lo quiere); al arrancar se borra `settings.lockCred`.
- Ajustes = raíz `#setRoot` (Saldos, Presupuesto total/tarjeta/efectivo, Tus datos, Ayuda) + subpantallas `.subpage` (`subCats`, `subRecs`, `subBackup`, `subPay`) que entran desde la derecha (`pushSub`/`popSub`, `subPos`; transición CSS que parte del valor actual) y se cierran deslizando desde el borde izquierdo. Cada fila lleva un resumen (`updateSummaries`). `#backupWarn` solo en la raíz si hace falta copia.
- Apple Pay solo en el móvil del dueño: `isOwner()` (inboxKey / payImported / lastPayImport).

## v19
- Buzón privado DESPLEGADO: secreto `ALLOWED_KEYS` con la clave de Josema (no está en el repo). Otras claves → 403.
- Quitado el enlace `#propietario` (se borra `settings.owner`).
- Subpantallas de Ajustes en liquid glass tintado con el color de su fila (`--c` en cada `.subpage`: categorías naranja, fijos morado, copia azul, Apple Pay verde), misma receta que `.sheet`. La raíz se apaga (opacidad ~0,06) al entrar, porque el backdrop-filter anidado no la difumina.
