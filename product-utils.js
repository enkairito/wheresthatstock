const STATUS_LABEL = {
  sin_confirmar: { text: "Sin confirmar", cls: "unavailable" },
  compra_directa: { text: "Disponible", cls: "available" },
  invitacion: { text: "Invitación", cls: "invitation" },
  preventa: { text: "Preventa", cls: "preventa" },
  no_disponible: { text: "Agotado", cls: "unavailable" },
};

function timeAgo(iso) {
  if (!iso) return "sin datos";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < -300000) return "fecha no válida";
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

// Rutas absolutas ("/assets/...") a propósito: product-utils.js lo usan
// tanto las páginas de listado (en la raíz, donde daría igual) como
// producto.html/404.html, que a veces se sirven bajo /producto/{id} — ahí
// una ruta relativa se buscaría dentro de esa carpeta y fallaría.
const FLAG_ICONS = {
  ES: "/assets/flags/es.png",
  ECI: "/assets/flags/es.png",
  CAR: "/assets/flags/es.png",
  FNAC: "/assets/flags/es.png",
  TRU: "/assets/flags/es.png",
  UK: "/assets/flags/gb.png",
  US: "/assets/flags/us.png",
};

// Solo Amazon (ES/UK/US) tiene el logo de Amazon; otras tiendas (ej. El
// Corte Inglés) no lo llevan salvo que se añada su propio icono a este mapa.
const STORE_ICONS = {
  ES: "/assets/amazon-logo.png",
  UK: "/assets/amazon-logo.png",
  US: "/assets/amazon-logo.png",
  ECI: "/assets/eci-logo.webp",
  CAR: "/assets/carrefour-logo.svg",
  FNAC: "/assets/fnac-logo.svg",
  TRU: "/assets/toysrus-logo.svg",
};

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Los nombres/precios/enlaces de producto vienen de listados de Amazon/El
// Corte Inglés — datos externos que no controlamos — y se inyectan en el
// DOM vía innerHTML (ver cardHtml más abajo), así que hay que escaparlos
// antes de montar el HTML o un título de producto manipulado podría
// ejecutar JS en la página de cualquier visitante.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

function parseMoney(value) {
  const match = String(value || "").trim().match(/^(?:(EUR|GBP|USD|€|£|\$)\s*)?([0-9][0-9., \u00a0\u202f]*?)(?:\s*(EUR|GBP|USD|€|£|\$))?$/i);
  if (!match) return null;
  const currencyOf = c => ({ "€": "EUR", "£": "GBP", "$": "USD" }[c] || (c || "EUR").toUpperCase());
  if (match[1] && match[3] && currencyOf(match[1]) !== currencyOf(match[3])) return null;
  const currency = currencyOf(match[1] || match[3]);
  const number = match[2].trim().replace(/[ \u00a0\u202f]/g, "");
  const comma = /^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/;
  const dot = /^(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/;
  let amount;
  if (comma.test(number)) amount = Number(number.replace(/\./g, "").replace(",", "."));
  else if (dot.test(number)) amount = Number(number.replace(/,/g, ""));
  else if (/^\d+$/.test(number)) amount = Number(number);
  else return null;
  return Number.isFinite(amount) ? { amount, currency } : null;
}

// Catalog price controls are in euros; never compare another currency as EUR.
function parsePrice(value) {
  const money = parseMoney(value);
  return money && money.currency === "EUR" ? money.amount : null;
}

function discountPercent(p) {
  const orig = parseMoney(p.original_price);
  const cur = parseMoney(p.price);
  if (!orig || !cur || orig.currency !== cur.currency || !orig.amount || orig.amount <= cur.amount) return 0;
  return Math.round(((orig.amount - cur.amount) / orig.amount) * 100);
}

function firstSeenTime(p) {
  const t = p.first_seen ? Date.parse(p.first_seen) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function productUrl(p) {
  // ID compacto "MP-ASIN" (ej. "ES-B0GZKZ1FL9"). No hace falta codificar de
  // qué archivo JSON viene (_src) porque el ASIN ya es único de por sí — la
  // página de producto consulta los orígenes registrados en producto.js.
  return `/producto/${encodeURIComponent(p.marketplace || "")}-${encodeURIComponent(p.asin || "")}`;
}

function cardHtml(p) {
  const statusInfo = STATUS_LABEL[p.status] || STATUS_LABEL.no_disponible;
  const discount = discountPercent(p);
  const name = escapeHtml(p.name || "");
  const link = escapeHtml(p.link || "");
  const returnTo = safeListingReturn(location.pathname + location.search);
  const detailUrl = escapeHtml(productUrl(p) + (returnTo ? "?return=" + encodeURIComponent(returnTo) : ""));
  const storeLabel = escapeHtml(`${p.store_label || "Amazon"} ${p.flag || ""}`.trim());
  const priceRow = p.price
    ? `<div class="price-row">
        ${p.original_price && p.original_price !== p.price ? `<span class="price-original">${escapeHtml(p.original_price)}</span>` : ""}
        <span class="price">${escapeHtml(p.price)}</span>
       </div>`
    : "";
  const stockNote = p.stock ? `<div class="stock-note">Solo queda(n) ${escapeHtml(p.stock)} en stock</div>` : "";
  const available = p.status === "compra_directa" || p.status === "invitacion" || p.status === "preventa";
  const btnLabel = p.status === "invitacion" ? "Solicitar invitación" : p.status === "preventa" ? "Reservar ahora" : (available ? "Ver en tienda" : "Agotado");
  // Cuando no está disponible, usamos <span> en vez de <a href="#"> — un
  // enlace real seguiría siendo enfocable y "activable" por teclado aunque
  // pointer-events:none bloquee el ratón, llevando a un salto de página sin
  // sentido. Un <span> no entra en el orden de tabulación.
  const buyButton = p.status === "sin_confirmar"
    ? `<a class="buy-btn" href="${detailUrl}">Ver ficha</a>`
    : available
    ? `<a class="buy-btn" href="${link}" target="_blank" rel="noopener">${btnLabel}</a>`
    : `<span class="buy-btn disabled" aria-disabled="true">${btnLabel}</span>`;

  return `
    <div class="card" data-name="${name.toLowerCase()}">
      <a class="card-img" href="${detailUrl}" aria-label="Ver ficha de ${name}">
        ${productImageHtml(p)}
        <div class="card-corner" title="${storeLabel}">
          ${STORE_ICONS[p.marketplace] ? `<span class="corner-icon"><img src="${STORE_ICONS[p.marketplace]}" alt="${storeLabel}" width="20" height="20"></span>` : ""}
          ${FLAG_ICONS[p.marketplace] ? `<span class="corner-icon"><img src="${FLAG_ICONS[p.marketplace]}" alt="${escapeHtml(p.marketplace)}" width="20" height="14"></span>` : ""}
          ${p.status !== "compra_directa" ? `<span class="badge status ${statusInfo.cls}">${statusInfo.text}</span>` : ""}
        </div>
        ${discount > 0 ? `<div class="card-corner-right"><span class="badge discount">-${discount}%</span></div>` : ""}
      </a>
      <div class="card-body">
        <div class="card-save-row">${p.game ? `<span class="card-game">${escapeHtml(p.game)}</span>` : "<span></span>"}${favoriteButton(p)}</div>
        <a class="card-name" href="${detailUrl}">${name}</a>
        ${priceRow}
        ${stockNote}
        ${buyButton}
      </div>
    </div>
  `;
}


const GAME_SOURCES = ["products.json", "onepiece.json", "magic.json", "lorcana.json", "yugioh.json"];
// Gaming (Nintendo/PlayStation/Xbox) existe como sección propia pero
// todavía no se mezcla con TCG en portada/Novedades/Ofertas — el foco
// sigue siendo TCG por ahora. Solo se usa donde hace falta explícitamente
// (favoritos, para que un producto de Gaming ya guardado siga funcionando).
const GAMING_SOURCES = ["nintendo.json", "playstation.json", "xbox.json"];

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStock(url) {
  const data = await fetchJson(url);
  if (!data || !Array.isArray(data.products)) throw new Error("Listado inválido");
  return data;
}

// Cabecera discreta; los avisos de salud quedan en el monitor interno.
function updateStockLabel(sources, results) {
  const refresh = () => {
    const live = document.getElementById("live-text");
    if (!live) return;
    const stamp = sources.length === 1 && sources[0] !== "accesorios.json"
      && results[0].status === "fulfilled" ? results[0].value.updated_at : null;
    const age = Date.now() - Date.parse(stamp);
    live.textContent = stamp && Number.isFinite(age) && age >= -300000
      ? timeAgo(stamp) : "catálogo de productos";
  };
  refresh();
  clearInterval(updateStockLabel.timer);
  updateStockLabel.timer = setInterval(refresh, 60000);
}


const FAVORITES_KEY = "wts-favorites-v1";
const favoriteProducts = new Map();
const favoriteId = p => `${p.marketplace}:${p.asin}`;

function readFavorites() {
  try {
    const rows = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    if (!Array.isArray(rows)) return [];
    return [...new Map(rows.filter(p => p && typeof p.marketplace === "string" && typeof p.asin === "string" && p.marketplace && p.asin)
      .map(p => [favoriteId(p), { marketplace: p.marketplace, asin: p.asin, name: typeof p.name === "string" ? p.name : "Producto guardado" }])).values()];
  } catch { return []; }
}

function favoriteButton(p) {
  const key = favoriteId(p);
  favoriteProducts.set(key, p);
  const saved = readFavorites().some(row => favoriteId(row) === key);
  const action = saved ? "Quitar de favoritos" : "Guardar en favoritos";
  return `<button type="button" class="favorite-button" data-favorite="${escapeHtml(key)}" data-product-name="${escapeHtml(p.name || "Producto")}" aria-pressed="${saved}" aria-label="${action}: ${escapeHtml(p.name || "Producto")}" title="${action}"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button>`;
}

function announceFavorite(message) {
  let notice = document.getElementById("favorite-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "favorite-notice";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(announceFavorite.timer);
  announceFavorite.timer = setTimeout(() => { notice.hidden = true; }, 4000);
}

function syncFavoriteButtons() {
  const saved = new Set(readFavorites().map(favoriteId));
  document.querySelectorAll("[data-favorite]").forEach(button => {
    const active = saved.has(button.dataset.favorite);
    const action = active ? "Quitar de favoritos" : "Guardar en favoritos";
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", `${action}: ${button.dataset.productName}`);
    button.title = action;
  });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-favorite]");
  if (!button) return;
  const key = button.dataset.favorite;
  const product = favoriteProducts.get(key);
  if (!product) return;
  const saved = readFavorites();
  const exists = saved.some(row => favoriteId(row) === key);
  const next = exists ? saved.filter(row => favoriteId(row) !== key)
    : [...saved, { marketplace: product.marketplace, asin: product.asin, name: product.name || "Producto guardado" }];
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); }
  catch {
    announceFavorite("No se pudo guardar el cambio. Comprueba que tu navegador permite guardar datos de esta web.");
    return;
  }
  syncFavoriteButtons();
  announceFavorite(exists ? "Producto eliminado de favoritos" : "Producto guardado en favoritos");
  document.dispatchEvent(new Event("favorites-changed"));
});
window.addEventListener("storage", event => {
  if (event.key !== FAVORITES_KEY && event.key !== null) return;
  syncFavoriteButtons();
  document.dispatchEvent(new Event("favorites-changed"));
});


function productImageHtml(product) {
  const hasImage = Boolean(product.image);
  return `<span class="product-image-frame" data-image-state="${hasImage ? "loading" : "missing"}">
    <span class="product-image-placeholder" aria-hidden="true"><svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="10" y="6" width="26" height="34" rx="3"/><path d="M6 13v27a4 4 0 0 0 4 4h20M16 28l6-7 5 5 3-3M16 14h7"/></svg><span>${hasImage ? "Cargando imagen" : "Imagen no disponible"}</span></span>
    ${hasImage ? `<img class="product-image" data-stock-image src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name || "Producto")}" width="480" height="480" loading="lazy" decoding="async">` : ""}
  </span>`;
}

function hydrateProductImages(root) {
  let prioritized = 0;
  root.querySelectorAll("[data-stock-image]").forEach(img => {
    if (img.dataset.imageBound) return;
    img.dataset.imageBound = "true";
    const frame = img.closest(".product-image-frame");
    const ready = () => { frame.dataset.imageState = "ready"; };
    const failed = () => {
      frame.dataset.imageState = "error";
      img.hidden = true;
      frame.querySelector(".product-image-placeholder span").textContent = "Imagen no disponible";
    };
    img.addEventListener("load", ready, { once: true });
    img.addEventListener("error", failed, { once: true });
    const bounds = frame.getBoundingClientRect();
    if (bounds.top < window.innerHeight && bounds.bottom > 0 && bounds.left < window.innerWidth && bounds.right > 0) {
      img.fetchPriority = prioritized++ < 2 ? "high" : "auto";
      img.loading = "eager";
    }
    // Una imagen en caché puede haber terminado antes de registrar los eventos.
    if (img.complete) img.naturalWidth > 0 ? ready() : failed();
  });
}

// Shared search normalization for catalog and saved products.
function normalizeSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function safeListingReturn(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, location.origin);
    const path = url.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    const listings = ["/", "/index", "/ofertas", "/favoritos", "/pokemontcg", "/onepiece", "/magic", "/lorcana", "/yugioh", "/accesorios", "/cajas-de-coleccion", "/cajas-etb", "/colecciones-premium", "/sobres", "/latas"];
    const isSetHub = /^\/set\/[a-z0-9-]+$/.test(path);
    if (url.origin !== location.origin || url.username || url.password || !(listings.includes(path) || isSetHub)) return null;
    url.searchParams.delete("return");
    return url.pathname + url.search;
  } catch { return null; }
}
