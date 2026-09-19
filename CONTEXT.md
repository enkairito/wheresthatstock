# Contexto del proyecto — wheresthatstock

Frontend estático de **Where's That Stock** (wheresthatstock.com): compara
precio/disponibilidad de TCGs y gaming en varias tiendas, con alertas por
Telegram/WhatsApp gestionadas desde el repo hermano `pokestock-tcg-bot`
(scraping, backend, workflows). Ese repo es la fuente de la verdad para
cómo/cuándo se actualizan los datos; este repo solo renderiza.

Este fichero es para retomar trabajo técnico entre sesiones/máquinas —
para descripción de producto y decisiones de diseño ver `README.md` y
`DESIGN.md` de este mismo repo; para el histórico detallado del backend
ver el `CONTEXT.md` de `pokestock-tcg-bot`.

## Cómo funciona

- Datos: `products.json` (y variantes por juego/vertical: `onepiece.json`,
  `magic.json`, `lorcana.json`, `yugioh.json`, `nintendo.json`,
  `playstation.json`, `xbox.json`, `accesorios.json`) — los publica
  `pokestock-tcg-bot` en cada ejecución. **No editar estos JSON a mano.**
- Páginas de categoría (`pokemontcg.html`, `cajas-etb.html`, `sobres.html`,
  `latas.html`, `colecciones-premium.html`, `cajas-de-coleccion.html`, etc.):
  cada una tiene checkboxes `data-marketplace="<CODE>"` en el sidebar de
  filtros — el código de tienda debe coincidir exactamente con el que usa
  `pokestock-tcg-bot` (`ES`, `ECI`, `CAR`, `FNAC`, `TRU`, `GAME`, `MM`, `TC`,
  `UK`, `US`).
- `app.js`: `MARKETPLACE_SORT_PRIORITY` y `MARKETPLACE_FILTER_LABEL` — hay
  que añadir cada tienda nueva ahí también, o no aparece bien etiquetada/
  ordenada.
- `product-utils.js`: `STORE_ICONS` (logo por tienda) y `FLAG_ICONS` — las
  tiendas españolas (ES/ECI/CAR/FNAC/TRU/GAME/MM/TC) **no llevan bandera**,
  se da por hecho que son españolas; solo UK/US la llevan. Si añades una
  tienda nueva, descarga su logo (preferible: Wikimedia Commons con licencia
  PD-textlogo si es un wordmark simple, o el logo propio de la tienda para
  uso identificativo nominativo) a `assets/<tienda>-logo.png` y regístralo
  en `STORE_ICONS`.
- `SUPPORTED_MARKETPLACES` en `product-utils.js` se deriva de las claves de
  `STORE_ICONS` — no hace falta tocarlo aparte.
- Al añadir una tienda nueva a una página de categoría, repetir el mismo
  bloque de checkbox en las 6 páginas de Pokémon TCG (son independientes,
  no hay un partial compartido de filtros).

## Patrón para añadir una tienda nueva (frontend)

1. Checkbox `data-marketplace="X"` en las 6 páginas de categoría.
2. `MARKETPLACE_SORT_PRIORITY` y `MARKETPLACE_FILTER_LABEL` en `app.js`.
3. `STORE_ICONS` en `product-utils.js` + logo descargado en `assets/`.
4. El scraping/backend real vive en `pokestock-tcg-bot` (ver su
   `CONTEXT.md`) — sin eso, el frontend no tendrá datos que mostrar aunque
   el filtro exista.

## Cosas pendientes / decisiones tomadas

- `product-groups.json`, `grouping-review.json`,
  `product-group-overrides.json` — sistema de agrupación de productos
  (mismo producto en varias tiendas) hecho por **Codex**. No tocar salvo
  que el usuario lo pida explícitamente. Ver `PRODUCT_GROUPING.md` en
  `pokestock-tcg-bot` para el diseño.
- Fnac: el scraping en vivo está desactivado (bloqueo de Datadome sin
  resolver); sus fichas en la web vienen de un catálogo estático publicado
  por `pokestock-tcg-bot`, marcadas como disponibilidad "no confirmada".
- Ajuste pendiente de tipografía del topnav (TCG/Ofertas/Noticias/
  Calendario) — más grande, sin hacer todavía.
- Identidad de marca "question-card" ya aprobada — fuente de la verdad en
  `assets/brand/`.
