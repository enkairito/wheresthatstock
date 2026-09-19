let homeLoadSequence = 0;
let activityLoadSequence = 0;
const homeHeading = document.getElementById("welcome-title");
homeHeading.tabIndex = -1;
const homeCatalogNotice = createLoadNotice("home-catalog-notice", document.getElementById("newest-section"), loadHomeCatalog, homeHeading);
const activityHeading = document.querySelector("#activity-section h2");
activityHeading.tabIndex = -1;
const activityNotice = createLoadNotice("activity-load-notice", document.getElementById("activity-list"), loadHomeActivity, activityHeading);

async function loadHomeCatalog() {
  const sequence = ++homeLoadSequence;
  const grids = ["newest-grid", "deals-grid"].map(id => document.getElementById(id));
  grids.forEach(grid => grid.setAttribute("aria-busy", "true"));
  try {
    const results = await Promise.allSettled(GAME_SOURCES.map(fetchStock));
    if (sequence !== homeLoadSequence) return;
    // "_src" viaja con cada producto para poder enlazar a su página
    // individual (producto.html) — ver la misma nota en app.js.
    updateStockLabel(GAME_SOURCES, results);
    if (results.every(r => r.status === "rejected")) throw new Error("Sin datos");
    const products = [...new Map(results.flatMap((r, i) => r.status === "fulfilled"
      ? r.value.products.map(p => [`${p.marketplace}:${p.asin}`, { ...p, _src: GAME_SOURCES[i] }]) : [])).values()];

    const newest = products.slice().sort((a, b) => firstSeenTime(b) - firstSeenTime(a)).slice(0, 5);
    const bestDeals = products
      .filter(p => discountPercent(p) > 0)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 5);

    renderSection("newest-grid", "newest-section", newest);
    renderSection("deals-grid", "deals-section", bestDeals);
    const failed = results.some(r => r.status === "rejected" || r.value.invalid_products > 0);
    homeCatalogNotice(failed ? "Selección incompleta: no se pudieron cargar algunos productos." : "", failed);
  } catch {
    if (sequence !== homeLoadSequence) return;
    renderSection("newest-grid", "newest-section", []);
    renderSection("deals-grid", "deals-section", []);
    homeCatalogNotice("No se pudieron cargar las novedades y ofertas. Puedes seguir explorando los juegos.", true);
  } finally {
    if (sequence === homeLoadSequence) grids.forEach(grid => grid.setAttribute("aria-busy", "false"));
  }
}

function renderSection(gridId, sectionId, items) {
  const grid = document.getElementById(gridId);
  const section = document.getElementById(sectionId);
  if (!items.length) {
    grid.replaceChildren();
    section.style.display = "none";
    return;
  }
  section.style.display = "";
  grid.innerHTML = items.map(cardHtml).join("");
  hydrateProductImages(grid);
}

// Cada juego conserva su propio feed; un fallo no oculta los demás.
async function loadHomeActivity() {
  const sequence = ++activityLoadSequence;
  const list = document.getElementById("activity-list");
  list.setAttribute("aria-busy", "true");
  try {
    const results = await Promise.allSettled(GAME_SOURCES.map(async source => {
      const events = await fetchJson("activity-" + source);
      if (!Array.isArray(events)) throw new Error("Actividad inválida");
      const valid = events.filter(event => event && typeof event === "object"
        && typeof event.name === "string" && event.name.trim()
        && ["restock", "price_drop"].includes(event.type) && validObservationDate(event.ts));
      return { events: valid, incomplete: valid.length !== events.length };
    }));
    if (sequence !== activityLoadSequence) return;
    const events = results.flatMap(r => r.status === "fulfilled" ? r.value.events : []);
    renderActivity(events.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 8));
    const failed = results.filter(r => r.status === "rejected" || r.value.incomplete).length;
    activityNotice(failed ? "No se pudo cargar toda la actividad reciente." : "", failed > 0);
    document.getElementById("activity-section").style.display = events.length || failed ? "" : "none";
  } finally {
    if (sequence === activityLoadSequence) list.setAttribute("aria-busy", "false");
  }
}

loadHomeCatalog();
loadHomeActivity();

function renderActivity(events) {
  const list = document.getElementById("activity-list");
  const section = document.getElementById("activity-section");
  if (!list || !section) return;
  if (!events.length) {
    list.replaceChildren();
    section.style.display = "none";
    return;
  }
  section.style.display = "";
  list.innerHTML = events.map(activityItemHtml).join("");
}

function activityItemHtml(e) {
  const name = escapeHtml(e.name || "");
  const link = escapeHtml(e.link || "#");
  const image = escapeHtml(e.image || "");
  const storeLabel = escapeHtml(`${e.store_label || ""} ${e.flag || ""}`.trim());
  const actionText = e.type === "price_drop"
    ? (e.prev_price && e.price
        ? `bajó de precio: ${escapeHtml(e.prev_price)} → ${escapeHtml(e.price)}`
        : "bajó de precio")
    : "registró disponibilidad en esa comprobación";
  return `
    <a class="activity-item" href="${link}" target="_blank" rel="noopener sponsored">
      ${e.image ? `<img class="activity-img" src="${image}" alt="" width="40" height="40" loading="lazy">` : ""}
      <div class="activity-body">
        <div class="activity-text"><strong>${name}</strong> ${actionText}</div>
        <div class="activity-meta">${escapeHtml(e.game || "Pokémon")} · ${storeLabel} · ${timeAgo(e.ts)}</div>
      </div>
    </a>
  `;
}
