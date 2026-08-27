const STATUS_LABEL = {
  compra_directa: { text: "Disponible", cls: "available" },
  invitacion: { text: "Invitación", cls: "invitation" },
  no_disponible: { text: "Agotado", cls: "unavailable" },
};

function timeAgo(iso) {
  if (!iso) return "sin datos";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

const FLAG_ICONS = {
  ES: "assets/flags/es.png",
  ECI: "assets/flags/es.png",
  UK: "assets/flags/gb.png",
  US: "assets/flags/us.png",
};

// Solo Amazon (ES/UK/US) tiene el logo de Amazon; otras tiendas (ej. El
// Corte Inglés) no lo llevan salvo que se añada su propio icono a este mapa.
const STORE_ICONS = {
  ES: "assets/amazon-logo.png",
  UK: "assets/amazon-logo.png",
  US: "assets/amazon-logo.png",
  ECI: "assets/eci-logo.webp",
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

function parsePrice(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
  if (!match) return null;
  return parseFloat(match[1].replace(/\./g, "") + "." + match[2]);
}

function discountPercent(p) {
  const orig = parsePrice(p.original_price);
  const cur = parsePrice(p.price);
  if (!orig || !cur || orig <= cur) return 0;
  return Math.round(((orig - cur) / orig) * 100);
}

function firstSeenTime(p) {
  const t = p.first_seen ? Date.parse(p.first_seen) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function cardHtml(p) {
  const statusInfo = STATUS_LABEL[p.status] || STATUS_LABEL.no_disponible;
  const discount = discountPercent(p);
  const name = escapeHtml(p.name || "");
  const image = escapeHtml(p.image || "");
  const link = escapeHtml(p.link || "");
  const storeLabel = escapeHtml(`${p.store_label || "Amazon"} ${p.flag || ""}`.trim());
  const priceRow = p.price
    ? `<div class="price-row">
        ${p.original_price && p.original_price !== p.price ? `<span class="price-original">${escapeHtml(p.original_price)}</span>` : ""}
        <span class="price">${escapeHtml(p.price)}</span>
       </div>`
    : "";
  const stockNote = p.stock ? `<div class="stock-note">Solo queda(n) ${escapeHtml(p.stock)} en stock</div>` : "";
  const available = p.status === "compra_directa" || p.status === "invitacion";
  const btnLabel = p.status === "invitacion" ? "Solicitar invitación" : (available ? "Cómpralo ya" : "Agotado");
  const btnHref = available ? link : "#";
  const btnClass = available ? "buy-btn" : "buy-btn disabled";

  return `
    <div class="card" data-name="${name.toLowerCase()}">
      <div class="card-img">
        ${p.image ? `<img src="${image}" alt="${name}" loading="lazy">` : ""}
        <div class="card-corner" title="${storeLabel}">
          ${STORE_ICONS[p.marketplace] ? `<span class="corner-icon"><img src="${STORE_ICONS[p.marketplace]}" alt="${storeLabel}"></span>` : ""}
          ${FLAG_ICONS[p.marketplace] ? `<span class="corner-icon"><img src="${FLAG_ICONS[p.marketplace]}" alt="${escapeHtml(p.marketplace)}"></span>` : ""}
          ${p.status !== "compra_directa" ? `<span class="badge status ${statusInfo.cls}">${statusInfo.text}</span>` : ""}
        </div>
        ${discount > 0 ? `<div class="card-corner-right"><span class="badge discount">-${discount}%</span></div>` : ""}
      </div>
      <div class="card-body">
        <div class="card-name">${name}</div>
        ${priceRow}
        ${stockNote}
        <a class="${btnClass}" href="${btnHref}" target="_blank" rel="noopener">${btnLabel}</a>
      </div>
    </div>
  `;
}
