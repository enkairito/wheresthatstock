Promise.allSettled(GAME_SOURCES.map(fetchStock))
  .then(results => {
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
  hydrateProductImages(grid);
}

// Cada juego conserva su propio feed; un fallo no oculta los demás.
Promise.allSettled(GAME_SOURCES.map(source => fetchJson("activity-" + source)))
  .then(results => {
    const events = results.flatMap(r => r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []);
    renderActivity(events.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 8));
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed) {
      const section = document.getElementById("activity-section");
      section.style.display = "";
      const note = document.createElement("p");
      note.textContent = "No se pudo cargar toda la actividad reciente.";
      section.append(note);
    }
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
    <a class="activity-item" href="${link}" target="_blank" rel="noopener sponsored">
      ${e.image ? `<img class="activity-img" src="${image}" alt="" width="40" height="40" loading="lazy">` : ""}
      <div class="activity-body">
        <div class="activity-text"><strong>${name}</strong> ${actionText}</div>
        <div class="activity-meta">${escapeHtml(e.game || "Pokémon")} · ${storeLabel} · ${timeAgo(e.ts)}</div>
      </div>
    </a>
  `;
}
