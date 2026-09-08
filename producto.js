// Rutas absolutas ("/algo") a propósito, no relativas: esta página se
// sirve a veces bajo /producto/{id} (una carpeta más profunda que el resto
// del sitio), y una ruta relativa como "styles.css" se buscaría dentro de
// /producto/ en vez de en la raíz — descubierto 2026-09-06 viendo la
// página sin ningún estilo aplicado.
const CATEGORY_LINKS = {
  "products.json": { href: "/pokemontcg", label: "Pokémon TCG" },
  "onepiece.json": { href: "/onepiece", label: "One Piece TCG" },
  "magic.json": { href: "/magic", label: "Magic: The Gathering" },
  "lorcana.json": { href: "/lorcana", label: "Disney Lorcana" },
  "yugioh.json": { href: "/yugioh", label: "Yu-Gi-Oh!" },
  "accesorios.json": { href: "/accesorios", label: "Accesorios" },
};
const SOURCE_FILES = Object.keys(CATEGORY_LINKS);

// Las fichas /producto/{id} son archivos HTML generados con datos persistentes.
function parseProductId() {
  const match = location.pathname.match(/\/producto\/([^/]+)$/);
  let raw = null;
  try { raw = match ? decodeURIComponent(match[1]) : null; } catch { return null; }
  if (raw) {
    const sep = raw.indexOf("-");
    if (sep > 0) return { mp: raw.slice(0, sep), asin: raw.slice(sep + 1) };
  }
  const params = new URLSearchParams(location.search);
  if (params.get("asin")) return { mp: params.get("mp") || "", asin: params.get("asin") };
  return null;
}

const id = parseProductId();
const detailEl = document.getElementById("product-detail");
const backLink = document.getElementById("back-link");

if (!id) {
  detailEl.innerHTML = `<p>Esta página no existe. <a href="/">Volver al inicio</a>.</p>`;
} else {
  findProduct(id.mp, id.asin);
}

async function findProduct(mp, asin) {
  const embedded = document.getElementById("product-data");
  const cached = embedded ? JSON.parse(embedded.textContent) : null;
  if (cached) {
    setBackLink(cached._src);
    render(cached);
  }
  const results = await Promise.allSettled(SOURCE_FILES.map(f => fetchStock("/" + f)));
  const stats = await fetchJson("/restock_stats.json").catch(() => ({}));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "fulfilled") continue;
    const product = r.value.products.find(p => p.asin === asin && p.marketplace === mp);
    if (product) {
      setBackLink(SOURCE_FILES[i]);
      updateStockLabel([SOURCE_FILES[i]], [r]);
      render(product, stats[`${mp}:${asin}`]);
      return;
    }
  }
  // La búsqueda antigua por parámetros también puede recuperar una ficha archivada.
  const archives = cached ? [] : await Promise.allSettled(SOURCE_FILES.map(f => fetchStock("/catalog-" + f)));
  const archived = cached || archives.flatMap(r => r.status === "fulfilled" ? r.value.products : [])
    .find(p => p.asin === asin && p.marketplace === mp);
  if (archived) {
    const index = SOURCE_FILES.indexOf(archived._src);
    const result = results[index] || { status: "rejected" };
    setBackLink(archived._src);
    updateStockLabel([archived._src], [result]);
    render({ ...archived, status: "sin_confirmar", stock: null }, stats[`${mp}:${asin}`]);
    return;
  }
  const failed = results.some(r => r.status === "rejected") || archives.some(r => r.status === "rejected");
  detailEl.innerHTML = `<p>${failed ? "No se pudo completar la búsqueda. Inténtalo de nuevo más tarde." : "No tenemos una ficha de este producto."} <a href="/">Ver los juegos</a>.</p>`;
}

function setBackLink(src) {
  const category = CATEGORY_LINKS[src] || CATEGORY_LINKS["products.json"];
  backLink.href = category.href;
  backLink.textContent = `← Volver a ${category.label}`;
}

function render(p, restockCount) {
  const statusInfo = STATUS_LABEL[p.status] || STATUS_LABEL.no_disponible;
  const discount = discountPercent(p);
  const name = escapeHtml(p.name || "");
  const image = escapeHtml(p.image || "");
  const link = escapeHtml(p.link || "");
  const storeLabel = escapeHtml(`${p.store_label || "Amazon"} ${p.flag || ""}`.trim());

  document.title = `${p.name} — Where's That Stock`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", `${p.name} — ${p.price || "consulta el precio"} en ${storeLabel}. Consulta la última disponibilidad observada.`);

  const available = p.status === "compra_directa" || p.status === "invitacion" || p.status === "preventa";
  const btnLabel = p.status === "sin_confirmar" ? "Consultar en la tienda" : p.status === "invitacion" ? "Solicitar invitación" : p.status === "preventa" ? "Reservar ahora" : (available ? "Ver en tienda" : "Agotado");
  const buyButton = available || p.status === "sin_confirmar"
    ? `<a class="buy-btn" href="${link}" target="_blank" rel="noopener">${btnLabel}</a>`
    : `<span class="buy-btn disabled" aria-disabled="true">${btnLabel}</span>`;

  const priceRow = p.price
    ? `<div class="price-row">
        ${p.original_price && p.original_price !== p.price ? `<span class="price-original">${escapeHtml(p.original_price)}</span>` : ""}
        <span class="price">${escapeHtml(p.price)}</span>
       </div>`
    : "";
  const stockNote = p.stock ? `<div class="stock-note">Solo queda(n) ${escapeHtml(p.stock)} en stock</div>` : "";
  // Solo se muestra a partir de 2: con 1 restock detectado el dato no dice
  // nada útil (todo producto ha restockeado "al menos una vez" si está en
  // la web ahora mismo).
  const restockNote = restockCount >= 2 ? `<div class="restock-note">🔁 Visto en stock ${restockCount} veces esta semana</div>` : "";

  detailEl.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-img">
        ${p.image ? `<img src="${image}" alt="${name}">` : ""}
      </div>
      <div class="product-detail-body">
        <div class="product-detail-store" title="${storeLabel}">
          ${STORE_ICONS[p.marketplace] ? `<img src="${STORE_ICONS[p.marketplace]}" alt="">` : ""}
          ${FLAG_ICONS[p.marketplace] ? `<img src="${FLAG_ICONS[p.marketplace]}" alt="">` : ""}
          <span>${storeLabel}</span>
          <span class="badge status ${statusInfo.cls}">${statusInfo.text}</span>
        </div>
        <h1>${name}</h1>
        ${p.status === "sin_confirmar" ? `<p>Ya no aparece en el listado actual. Disponibilidad sin confirmar.</p><p>Última vez visto: ${escapeHtml(p.last_seen || "sin fecha")}. El precio mostrado es el último observado.</p>` : ""}
        ${priceRow}
        ${discount > 0 ? `<span class="badge discount">-${discount}%</span>` : ""}
        ${stockNote}
        ${restockNote}
        <div class="detail-actions">${buyButton}${favoriteButton(p)}</div>
      </div>
    </div>
  `;
}
