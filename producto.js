// Rutas absolutas ("/algo") a propósito, no relativas: esta página se
// sirve a veces bajo /producto/{id} (una carpeta más profunda que el resto
// del sitio), y una ruta relativa como "styles.css" se buscaría dentro de
// /producto/ en vez de en la raíz — descubierto 2026-09-06 viendo la
// página sin ningún estilo aplicado.
const CATEGORY_LINKS = {
  "products.json": { href: "/pokemontcg", label: "Pokémon TCG" },
  "onepiece.json": { href: "/onepiece", label: "One Piece TCG" },
  "accesorios.json": { href: "/accesorios", label: "Accesorios" },
};
const SOURCE_FILES = Object.keys(CATEGORY_LINKS);

// La URL "bonita" (/producto/ES-B0GZKZ1FL9) la sirve GitHub Pages a través
// de 404.html (no hay servidor real detrás para reescribir rutas), así que
// esta misma lógica se usa desde ambos ficheros. Si por lo que sea alguien
// entra directo a producto.html con los parámetros antiguos (?mp=&asin=),
// también se soporta como respaldo.
function parseProductId() {
  const match = location.pathname.match(/\/producto\/([^/]+)$/);
  const raw = match ? decodeURIComponent(match[1]) : null;
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

function findProduct(mp, asin) {
  const productFetches = SOURCE_FILES.map(f => fetch("/" + f + "?t=" + Date.now()).then(r => r.json()));
  // restock_stats.json lo genera restock_stats.py explotando el historial
  // de git de state.json (ver ese script) — cuántas veces ha pasado cada
  // producto de agotado a disponible en los últimos 7 días. Va aparte
  // porque no todos los productos tienen entrada ahí (solo los que han
  // restockeado al menos una vez recientemente).
  const statsFetch = fetch("/restock_stats.json?t=" + Date.now()).then(r => r.json()).catch(() => ({}));

  Promise.allSettled([...productFetches, statsFetch])
    .then(results => {
      const productResults = results.slice(0, SOURCE_FILES.length);
      const statsResult = results[results.length - 1];
      const stats = statsResult.status === "fulfilled" ? statsResult.value : {};

      const liveText = document.getElementById("live-text");
      const firstOk = productResults.find(r => r.status === "fulfilled");
      if (liveText && firstOk) liveText.textContent = timeAgo(firstOk.value.updated_at);

      for (let i = 0; i < productResults.length; i++) {
        const r = productResults[i];
        if (r.status !== "fulfilled") continue;
        const match = (r.value.products || []).find(p => p.asin === asin && p.marketplace === mp);
        if (match) {
          setBackLink(SOURCE_FILES[i]);
          render(match, stats[`${mp}:${asin}`]);
          return;
        }
      }
      setBackLink("products.json");
      detailEl.innerHTML = `<p>No hemos encontrado este producto — puede que haya dejado de estar en stock. <a href="/pokemontcg">Ver todo Pokémon TCG</a>.</p>`;
    })
    .catch(() => {
      detailEl.innerHTML = `<p>No se pudo cargar el producto. <a href="/">Volver al inicio</a>.</p>`;
    });
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
  if (metaDesc) metaDesc.setAttribute("content", `${p.name} — ${p.price || "consulta el precio"} en ${storeLabel}. Consulta el stock en directo.`);

  const available = p.status === "compra_directa" || p.status === "invitacion";
  const btnLabel = p.status === "invitacion" ? "Solicitar invitación" : (available ? "Cómpralo ya" : "Agotado");
  const buyButton = available
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
        ${priceRow}
        ${discount > 0 ? `<span class="badge discount">-${discount}%</span>` : ""}
        ${stockNote}
        ${restockNote}
        ${buyButton}
      </div>
    </div>
  `;
}
