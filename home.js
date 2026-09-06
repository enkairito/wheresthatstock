fetch("products.json?t=" + Date.now())
  .then(r => r.json())
  .then(data => {
    // "_src" viaja con cada producto para poder enlazar a su página
    // individual (producto.html) — ver la misma nota en app.js.
    const products = (data.products || []).map(p => ({ ...p, _src: "products.json" }));
    const liveText = document.getElementById("live-text");
    if (liveText) liveText.textContent = "Actualizado " + timeAgo(data.updated_at);

    // Mismo criterio que el sort "newest" de app.js (Amazon ES, luego El
    // Corte Inglés, luego Amazon US, luego Amazon UK) — mantener ambos en
    // sincronía si este orden cambia alguna vez.
    const MARKETPLACE_SORT_PRIORITY = { ES: 0, ECI: 1, US: 2, UK: 3 };
    const newest = products.slice().sort((a, b) => {
      const marketplaceDiff = (MARKETPLACE_SORT_PRIORITY[a.marketplace] ?? 99) - (MARKETPLACE_SORT_PRIORITY[b.marketplace] ?? 99);
      if (marketplaceDiff !== 0) return marketplaceDiff;
      return firstSeenTime(b) - firstSeenTime(a);
    }).slice(0, 5);
    const bestDeals = products
      .filter(p => discountPercent(p) > 0)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 5);

    renderSection("newest-grid", "newest-section", newest);
    renderSection("deals-grid", "deals-section", bestDeals);
  })
  .catch(() => {
    const liveText = document.getElementById("live-text");
    if (liveText) liveText.textContent = "No se pudo cargar el stock";
  });

function renderSection(gridId, sectionId, items) {
  const grid = document.getElementById(gridId);
  const section = document.getElementById(sectionId);
  if (!items.length) {
    section.style.display = "none";
    return;
  }
  grid.innerHTML = items.map(cardHtml).join("");
}

// events.json lo genera el bot en cada ejecución (ver check_stock.py /
// build_event): un evento por restock o bajada de precio detectados, de
// las 4 tiendas (a diferencia de Telegram, que solo avisa ES/ECI). Los
// más recientes van al final del array.
fetch("events.json?t=" + Date.now())
  .then(r => r.json())
  .then(events => renderActivity(events.slice(-8).reverse()))
  .catch(() => {
    const section = document.getElementById("activity-section");
    if (section) section.style.display = "none";
  });

function renderActivity(events) {
  const list = document.getElementById("activity-list");
  const section = document.getElementById("activity-section");
  if (!list || !section) return;
  if (!events.length) {
    section.style.display = "none";
    return;
  }
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
    : "ya está disponible";
  return `
    <a class="activity-item" href="${link}" target="_blank" rel="noopener">
      ${e.image ? `<img class="activity-img" src="${image}" alt="" loading="lazy">` : ""}
      <div class="activity-body">
        <div class="activity-text"><strong>${name}</strong> ${actionText}</div>
        <div class="activity-meta">${storeLabel} · hace ${timeAgo(e.ts)}</div>
      </div>
    </a>
  `;
}
