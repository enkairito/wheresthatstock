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
  "nintendo.json": { href: "/nintendo", label: "Nintendo" },
  "playstation.json": { href: "/playstation", label: "PlayStation" },
  "xbox.json": { href: "/xbox", label: "Xbox" },
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
  let cached = null;
  try { cached = embedded ? JSON.parse(embedded.textContent) : null; } catch {}
  let stats = {};
  fetchJson("/restock_stats.json").then(data => {
    stats = data;
    const note = document.getElementById("product-restocks");
    const count = stats[`${mp}:${asin}`];
    if (note && count >= 2) { note.hidden = false; note.textContent = `Visto en stock ${count} veces esta semana`; }
  }).catch(() => {});
  if (cached) { setBackLink(cached._src); render(cached); }
  const results = new Map();
  let found = false;
  const check = async source => {
    try {
      const value = await fetchStock("/" + source);
      const result = { status: "fulfilled", value };
      results.set(source, result);
      const product = value.products.find(p => p.asin === asin && p.marketplace === mp);
      if (product && !found) {
        found = true;
        setBackLink(source);
        updateStockLabel([source], [result]);
        render(product, stats[`${mp}:${asin}`]);
      }
    } catch { results.set(source, { status: "rejected" }); }
  };
  const preferred = cached && SOURCE_FILES.includes(cached._src) ? cached._src : null;
  if (preferred) { await check(preferred); if (found) return; }
  await Promise.allSettled(SOURCE_FILES.filter(source => source !== preferred).map(check));
  if (found) return;
  const archives = cached ? [] : await Promise.allSettled(SOURCE_FILES.map(f => fetchStock("/catalog-" + f)));
  const archived = cached || archives.flatMap(r => r.status === "fulfilled" ? r.value.products : [])
    .find(p => p.asin === asin && p.marketplace === mp);
  if (archived) {
    const result = results.get(archived._src) || { status: "rejected" };
    setBackLink(archived._src);
    updateStockLabel([archived._src], [result]);
    render({ ...archived, status: "sin_confirmar", stock: null }, stats[`${mp}:${asin}`]);
    return;
  }
  const failed = [...results.values(), ...archives].some(r => r.status === "rejected");
  detailEl.innerHTML = `<p>${failed ? "No se pudo completar la búsqueda. Inténtalo de nuevo más tarde." : "No tenemos una ficha de este producto."} <a href="/">Ver los juegos</a>.</p>`;
}

function setBackLink(src) {
  const category = CATEGORY_LINKS[src] || CATEGORY_LINKS["products.json"];
  const origin = safeListingReturn(new URLSearchParams(location.search).get("return"));
  backLink.href = origin || category.href;
  backLink.textContent = origin ? "← Volver a mi selección" : `← Volver a ${category.label}`;
}

function render(p, restockCount) {
  const statusInfo = STATUS_LABEL[p.status] || STATUS_LABEL.no_disponible;
  const discount = discountPercent(p);
  const name = escapeHtml(p.name || "");
  const link = escapeHtml(p.link || "");
  const storeLabel = escapeHtml(`${p.store_label || "Amazon"} ${p.flag || ""}`.trim());

  document.title = `${p.name} — Where's That Stock`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", `${p.name} — ${p.price || "consulta el precio"} en ${storeLabel}. Consulta la última disponibilidad observada.`);

  const available = p.status === "compra_directa" || p.status === "invitacion" || p.status === "preventa";
  const btnLabel = p.status === "sin_confirmar" ? "Consultar en la tienda" : p.status === "invitacion" ? "Solicitar invitación" : p.status === "preventa" ? "Reservar ahora" : (available ? "Ver en tienda" : "Agotado");
  const buyButton = available || p.status === "sin_confirmar"
    ? `<a class="buy-btn" href="${link}" target="_blank" rel="noopener sponsored">${btnLabel}</a>`
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


  detailEl.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-img">
        ${productImageHtml(p)}
      </div>
      <div class="product-detail-body">
        <div class="product-detail-store" title="${storeLabel}">
          ${STORE_ICONS[p.marketplace] ? `<img src="${STORE_ICONS[p.marketplace]}" alt="" width="20" height="20">` : ""}
          ${FLAG_ICONS[p.marketplace] ? `<img src="${FLAG_ICONS[p.marketplace]}" alt="" width="20" height="14">` : ""}
          <span>${storeLabel}</span>
          <span class="badge status ${statusInfo.cls}">${statusInfo.text}</span>
        </div>
        <h1>${name}</h1>
        ${p.status === "sin_confirmar" ? `<p>Ya no aparece en el listado actual. Disponibilidad sin confirmar.</p><p>Última vez visto: ${escapeHtml(p.last_seen || "sin fecha")}. El precio mostrado es el último observado.</p>` : ""}
        ${priceRow}
        ${discount > 0 ? `<span class="badge discount">-${discount}%</span>` : ""}
        ${stockNote}
        <div class="restock-note" id="product-restocks" ${restockCount >= 2 ? "" : "hidden"}>${restockCount >= 2 ? `Visto en stock ${restockCount} veces esta semana` : ""}</div>
        <div class="detail-actions">${buyButton}${favoriteButton(p)}<button type="button" id="share-product" class="utility-button">Compartir</button></div>
        <div id="share-fallback" hidden><label for="share-link">Enlace del producto</label><input id="share-link" type="url" readonly></div>
        <p id="share-status" role="status" class="share-status"></p>
      </div>
    </div>
  `;
  hydrateProductImages(detailEl);
  document.getElementById("share-product").addEventListener("click", () => shareProduct(p));
}

async function shareProduct(product) {
  const url = new URL(productUrl(product), location.origin).href;
  if (navigator.share) {
    try { await navigator.share({ title: product.name || "Where’s That Stock", url }); return; }
    catch (error) { if (error.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    document.getElementById("share-status").textContent = "Enlace copiado";
  } catch {
    document.getElementById("share-fallback").hidden = false;
    const input = document.getElementById("share-link");
    input.value = url;
    input.focus();
    input.select();
    document.getElementById("share-status").textContent = "Puedes copiar este enlace para compartirlo.";
  }
}
