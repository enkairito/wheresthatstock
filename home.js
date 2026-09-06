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
