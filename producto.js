const CATEGORY_LINKS = {
  "products.json": { href: "pokemontcg", label: "Pokémon TCG" },
  "onepiece.json": { href: "onepiece", label: "One Piece TCG" },
  "accesorios.json": { href: "accesorios", label: "Accesorios" },
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
  Promise.allSettled(SOURCE_FILES.map(f => fetch(f + "?t=" + Date.now()).then(r => r.json())))
    .then(results => {
      const liveText = document.getElementById("live-text");
      const firstOk = results.find(r => r.status === "fulfilled");
      if (liveText && firstOk) liveText.textContent = timeAgo(firstOk.value.updated_at);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== "fulfilled") continue;
        const match = (r.value.products || []).find(p => p.asin === asin && p.marketplace === mp);
        if (match) {
          setBackLink(SOURCE_FILES[i]);
          render(match);
          return;
        }
      }
      setBackLink("products.json");
      detailEl.innerHTML = `<p>No hemos encontrado este producto — puede que haya dejado de estar en stock. <a href="pokemontcg">Ver todo Pokémon TCG</a>.</p>`;
    })
    .catch(() => {
      detailEl.innerHTML = `<p>No se pudo cargar el producto. <a href="/">Volver al inicio</a>.</p>`;
    });
}

function setBackLink(src) {
  const category = CATEGORY_LINKS[src] || CATEGORY_LINKS["products.json"];
  backLink.href = "/" + category.href;
  backLink.textContent = `← Volver a ${category.label}`;
}

function render(p) {
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
        ${buyButton}
      </div>
    </div>
  `;
}
