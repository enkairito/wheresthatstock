const favoriteGrid = document.getElementById("favorite-grid");
const favoriteSearch = document.getElementById("favorite-search");
const favoriteSources = [...GAME_SOURCES, "accesorios.json"];
const favoriteCatalog = new Map();
let favoritesLoading = true;

function renderFavorites() {
  const saved = readFavorites();
  const query = favoriteSearch.value.trim().toLocaleLowerCase("es");
  const products = saved.map(row => favoriteCatalog.get(favoriteId(row)) || { ...row, status: "sin_confirmar" });
  const visible = products.filter(p => p.name.toLocaleLowerCase("es").includes(query));
  favoriteGrid.innerHTML = visible.map(cardHtml).join("");
  hydrateProductImages(favoriteGrid);
  document.getElementById("favorite-count").textContent = `${saved.length} ${saved.length === 1 ? "producto guardado" : "productos guardados"}`;
  document.getElementById("favorite-empty").hidden = saved.length > 0;
  if (saved.length && !visible.length) favoriteGrid.textContent = "No hay favoritos que coincidan con tu búsqueda.";
  favoriteGrid.setAttribute("aria-busy", String(favoritesLoading && saved.length > 0));
}

async function loadFavoriteCatalog() {
  if (readFavorites().length) {
    const results = await Promise.allSettled(favoriteSources.map(source => fetchStock("/" + source)));
    results.forEach((result, i) => {
      if (result.status === "fulfilled") result.value.products.forEach(p => favoriteCatalog.set(favoriteId(p), { ...p, _src: favoriteSources[i] }));
    });
  }
  favoritesLoading = false;
  renderFavorites();
}
favoriteSearch.addEventListener("input", renderFavorites);
document.addEventListener("favorites-changed", () => {
  const focused = document.activeElement;
  const wasFavoriteButton = focused && focused.hasAttribute("data-favorite");
  const buttons = [...favoriteGrid.querySelectorAll("[data-favorite]")];
  const index = buttons.indexOf(focused);
  renderFavorites();
  if (readFavorites().some(row => !favoriteCatalog.has(favoriteId(row)))) loadFavoriteCatalog();
  if (wasFavoriteButton) {
    const next = favoriteGrid.querySelectorAll("[data-favorite]");
    (next[Math.min(index, next.length - 1)] || favoriteSearch).focus();
  }
});
renderFavorites();
loadFavoriteCatalog();
