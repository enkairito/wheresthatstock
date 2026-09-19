const favoriteGrid = document.getElementById("favorite-grid");
const favoriteSearch = document.getElementById("favorite-search");
const favoriteSources = [...GAME_SOURCES, ...GAMING_SOURCES, "accesorios.json"];
const favoriteCatalog = new Map();
let favoritesLoading = true;
let favoriteLoadSequence = 0;
let favoriteFailedSources = 0;
const favoriteNotice = createLoadNotice("favorites-load-notice", favoriteGrid, loadFavoriteCatalog, favoriteSearch);
favoriteSearch.value = new URLSearchParams(location.search).get("q") || "";

function renderFavorites() {
  const focusedKey = favoriteGrid.contains(document.activeElement) ? document.activeElement.dataset.favorite : null;
  const saved = readFavorites();
  document.getElementById("export-favorites").disabled = saved.length === 0;
  const url = new URL(location.href);
  if (favoriteSearch.value.trim()) url.searchParams.set("q", favoriteSearch.value.trim());
  else url.searchParams.delete("q");
  if (url.href !== location.href) history.replaceState(history.state, "", url);
  const query = normalizeSearch(favoriteSearch.value);
  const products = saved.map(row => favoriteCatalog.get(favoriteId(row)) || { ...row, status: "sin_confirmar" });
  const visible = products.filter(p => normalizeSearch(p.name).includes(query));
  favoriteGrid.innerHTML = visible.map(cardHtml).join("");
  hydrateProductImages(favoriteGrid);
  document.getElementById("favorite-count").textContent = `${saved.length} ${saved.length === 1 ? "producto guardado" : "productos guardados"}`;
  document.getElementById("favorite-empty").hidden = saved.length > 0;
  if (saved.length && !visible.length) favoriteGrid.textContent = "No hay favoritos que coincidan con tu búsqueda.";
  favoriteGrid.setAttribute("aria-busy", String(favoritesLoading && saved.length > 0));
  if (focusedKey) ([...favoriteGrid.querySelectorAll("[data-favorite]")].find(button => button.dataset.favorite === focusedKey) || favoriteSearch).focus({ preventScroll: true });
  if (!saved.length) favoriteNotice("");
}

async function loadFavoriteCatalog() {
  const sequence = ++favoriteLoadSequence;
  favoritesLoading = true;
  favoriteGrid.setAttribute("aria-busy", String(readFavorites().length > 0));
  favoriteNotice(favoriteFailedSources && readFavorites().length ? "Actualizando tus favoritos…" : "", favoriteFailedSources > 0 && readFavorites().length > 0, true);
  const refreshed = new Map();
  if (readFavorites().length) {
    const results = await Promise.allSettled(favoriteSources.map(source => fetchStock("/" + source)));
    if (sequence !== favoriteLoadSequence) return;
    favoriteFailedSources = results.filter(result => result.status === "rejected").length;
    results.forEach((result, i) => {
      if (result.status === "fulfilled") result.value.products.forEach(p => refreshed.set(favoriteId(p), { ...p, _src: favoriteSources[i] }));
    });
  }
  // Replace the whole observation, including sources that failed or lost a product.
  // Saved names remain in localStorage, but old purchase claims must not survive.
  favoriteCatalog.clear();
  refreshed.forEach((product, key) => favoriteCatalog.set(key, product));
  favoritesLoading = false;
  renderFavorites();
  if (readFavorites().length) favoriteNotice(favoriteFailedSources ? "No se pudo comprobar todo el catálogo. Los favoritos sin datos aparecen como sin confirmar." : "", favoriteFailedSources > 0);
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

const transferStatus = document.getElementById("transfer-status");
const importFile = document.getElementById("import-favorites");
const importPreview = document.getElementById("import-preview");
let importCandidates = [];
let importSequence = 0;
const MAX_FAVORITE_IMPORT = 2000;

function validateFavoriteImport(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.favorites) || data.favorites.length > MAX_FAVORITE_IMPORT) throw new Error("El archivo no es una copia válida de favoritos de esta web.");
  const rows = data.favorites.map(row => {
    if (!row || !SUPPORTED_MARKETPLACES.has(row.marketplace)
        || typeof row.asin !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.asin)
        || typeof row.name !== "string" || !row.name.trim() || row.name.length > 500) throw new Error("El archivo contiene productos no válidos.");
    return { marketplace: row.marketplace, asin: row.asin, name: row.name };
  });
  return [...new Map(rows.map(row => [favoriteId(row), row])).values()];
}

document.getElementById("export-favorites").addEventListener("click", () => {
  const favorites = readFavorites();
  if (!favorites.length) return;
  const data = { version: 1, favorites: favorites.map(row => ({ ...row, name: row.name.slice(0, 500) })) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wts-favoritos.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  transferStatus.textContent = "Copia preparada para descargar.";
});
document.getElementById("choose-favorites").addEventListener("click", () => { importFile.value = ""; importFile.click(); });
importFile.addEventListener("change", async () => {
  const sequence = ++importSequence;
  importCandidates = [];
  importPreview.hidden = true;
  const file = importFile.files[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("El archivo supera el límite de 1 MB.");
    const text = await file.text();
    if (sequence !== importSequence) return;
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("No se pudo leer el archivo JSON."); }
    importCandidates = validateFavoriteImport(data);
    const saved = new Set(readFavorites().map(favoriteId));
    const added = importCandidates.filter(row => !saved.has(favoriteId(row))).length;
    if (saved.size + added > MAX_FAVORITE_IMPORT) throw new Error("La importación superaría el límite de 2000 favoritos.");
    transferStatus.textContent = "";
    document.getElementById("import-summary").textContent = `${added} favoritos nuevos; ${importCandidates.length - added} ya guardados. Se conservarán tus favoritos actuales.`;
    document.getElementById("confirm-import").disabled = added === 0;
    importPreview.hidden = false;
  } catch (error) { importCandidates = []; transferStatus.textContent = error.message; }
});
document.getElementById("cancel-import").addEventListener("click", () => {
  ++importSequence;
  importCandidates = [];
  importPreview.hidden = true;
  document.getElementById("choose-favorites").focus();
});
document.getElementById("confirm-import").addEventListener("click", () => {
  const current = readFavorites();
  const merged = new Map(current.map(row => [favoriteId(row), row]));
  importCandidates.forEach(row => { if (!merged.has(favoriteId(row))) merged.set(favoriteId(row), row); });
  if (merged.size > MAX_FAVORITE_IMPORT) { transferStatus.textContent = "La importación superaría el límite de 2000 favoritos."; return; }
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...merged.values()])); }
  catch { transferStatus.textContent = "No se pudo guardar la importación. Tus favoritos no se han modificado."; return; }
  transferStatus.textContent = `${merged.size - current.length} favoritos añadidos.`;
  importCandidates = [];
  importPreview.hidden = true;
  syncFavoriteButtons();
  document.dispatchEvent(new Event("favorites-changed"));
  document.getElementById("choose-favorites").focus();
});
window.addEventListener("popstate", () => { favoriteSearch.value = new URLSearchParams(location.search).get("q") || ""; renderFavorites(); });
