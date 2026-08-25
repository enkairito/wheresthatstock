fetch("products.json?t=" + Date.now())
  .then(r => r.json())
  .then(data => {
    const products = data.products || [];
    document.getElementById("live-text").textContent = "Actualizado " + timeAgo(data.updated_at);

    const newest = products.slice().sort((a, b) => firstSeenTime(b) - firstSeenTime(a)).slice(0, 10);
    const bestDeals = products
      .filter(p => discountPercent(p) > 0)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 10);

    renderSection("newest-grid", "newest-section", newest);
    renderSection("deals-grid", "deals-section", bestDeals);
  })
  .catch(() => {
    document.getElementById("live-text").textContent = "No se pudo cargar el stock";
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
