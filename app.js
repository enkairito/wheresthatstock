let allProducts = [];

function render(products) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");
  if (!products.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    count.textContent = "0 productos";
    empty.innerHTML = '<p>No se encontraron productos. Prueba con otro nombre o amplía los filtros.</p><button type="button" class="utility-button" id="reset-empty-filters">Limpiar filtros</button>';
    empty.querySelector("button").addEventListener("click", resetFilters);
    return;
  }
  empty.style.display = "none";
  count.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
  grid.innerHTML = products.map(cardHtml).join("");
  hydrateProductImages(grid);
}

const discountRangeEl = document.getElementById("discount-range");
const sortSelectEl = document.getElementById("sort-select");

let activeStatuses = new Set(["compra_directa", "invitacion", "preventa"]);
// Las tiendas y categorías varían según la página (Pokémon TCG tiene
// Amazon ES/UK/US/ECI/Carrefour/Fnac; otros juegos solo Amazon ES; etc.),
// así que ambas se leen directamente de los checkboxes presentes en el
// sidebar en vez de una lista fija — arrancan con los que ya vienen
// marcados como "checked" en el HTML de cada página.
let activeMarketplaces = new Set(
  [...document.querySelectorAll(".sidebar input[data-marketplace]:checked")].map(cb => cb.dataset.marketplace)
);
let activeCategories = new Set(
  [...document.querySelectorAll(".sidebar input[data-category]:checked")].map(cb => cb.dataset.category)
);
// Igual que las categorías: solo aparece en páginas que mezclan varios
// juegos (ej. Ofertas), así que se lee de los checkboxes si existen.
let activeGames = new Set(
  [...document.querySelectorAll(".sidebar input[data-game]:checked")].map(cb => cb.dataset.game)
);
let minDiscount = discountRangeEl ? Number(discountRangeEl.value) || 0 : 0;
let maxPrice = Infinity;
let sortMode = sortSelectEl ? sortSelectEl.value : "newest";

// Orden de prioridad de tienda para "Novedades" — solicitado explícitamente:
// primero Amazon ES, luego El Corte Inglés, luego Amazon US, luego Amazon UK.
// Preserve defaults from each page: offers start at a 1% discount.
const filterDefaults = { discount: minDiscount, sort: sortMode };
const filterGroups = [
  { key: "status", attr: "status", active: activeStatuses },
  { key: "store", attr: "marketplace", active: activeMarketplaces },
  { key: "category", attr: "category", active: activeCategories },
  { key: "game", attr: "game", active: activeGames },
].map(group => ({ ...group, defaults: [...group.active],
  inputs: [...document.querySelectorAll(`.sidebar input[data-${group.attr}]`)] }));
let filtersReady = false;
let catalogPriceMax = 200;

function restoreFilterUrl(params = new URLSearchParams(location.search)) {
  document.getElementById("search").value = params.get("q") || "";
  filterGroups.forEach(group => {
    const allowed = group.inputs.map(input => input.dataset[group.attr]);
    const requested = params.getAll(group.key).filter(value => allowed.includes(value));
    // An empty value means deliberately selecting none; unknown values use defaults.
    const selected = requested.length ? requested : params.get(group.key) === "" ? [] : group.defaults;
    group.active.clear();
    selected.forEach(value => group.active.add(value));
    group.inputs.forEach(input => { input.checked = group.active.has(input.dataset[group.attr]); });
  });
  const numberParam = (key, fallback) => {
    const raw = params.get(key);
    const value = raw === null || raw.trim() === "" ? NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  discountRangeEl.value = Math.max(Number(discountRangeEl.min), Math.min(Number(discountRangeEl.max), numberParam("discount", filterDefaults.discount)));
  minDiscount = Number(discountRangeEl.value);
  discountValue.textContent = `${minDiscount}% de descuento`;
  maxPrice = numberParam("price", catalogPriceMax);
  priceRange.max = Math.max(catalogPriceMax, maxPrice);
  priceInput.max = priceRange.max;
  priceRange.step = "0.01";
  priceInput.step = "0.01";
  priceRange.value = maxPrice;
  priceInput.value = maxPrice;
  priceInput.removeAttribute("aria-invalid");
  const requestedSort = params.get("sort");
  sortMode = [...sortSelectEl.options].some(option => option.value === requestedSort) ? requestedSort : filterDefaults.sort;
  sortSelectEl.value = sortMode;
}

function resetFilters() {
  restoreFilterUrl(new URLSearchParams());
  applyFilter();
  document.getElementById("search").focus();
}

function writeFilterUrl() {
  const url = new URL(location.href);
  const set = (key, value, fallback) => {
    url.searchParams.delete(key);
    if (value !== fallback) url.searchParams.set(key, String(value));
  };
  set("q", document.getElementById("search").value.trim(), "");
  set("sort", sortMode, filterDefaults.sort);
  set("discount", minDiscount, filterDefaults.discount);
  set("price", maxPrice, catalogPriceMax);
  filterGroups.forEach(group => {
    url.searchParams.delete(group.key);
    if (!group.inputs.length) return;
    if (group.active.size === group.defaults.length && group.defaults.every(value => group.active.has(value))) return;
    if (!group.active.size) url.searchParams.set(group.key, "");
    else group.active.forEach(value => url.searchParams.append(group.key, value));
  });
  // Replace avoids creating a browser history entry for every typed character.
  if (url.href !== location.href) history.replaceState(history.state, "", url);
}

window.addEventListener("popstate", () => {
  if (!filtersReady) return;
  restoreFilterUrl();
  applyFilter();
});

const MARKETPLACE_SORT_PRIORITY = { ES: 0, ECI: 1, CAR: 2, FNAC: 3, TRU: 4, GAME: 5, US: 6, UK: 7 };

function sortProducts(products) {
  const sorted = products.slice();
  if (sortMode === "price-asc") {
    sorted.sort((a, b) => (parsePrice(a.price) ?? Infinity) - (parsePrice(b.price) ?? Infinity));
  } else if (sortMode === "price-desc") {
    sorted.sort((a, b) => (parsePrice(b.price) ?? -Infinity) - (parsePrice(a.price) ?? -Infinity));
  } else if (sortMode === "discount") {
    sorted.sort((a, b) => discountPercent(b) - discountPercent(a));
  } else if (sortMode === "newest") {
    sorted.sort((a, b) => {
      const marketplaceDiff = (MARKETPLACE_SORT_PRIORITY[a.marketplace] ?? 99) - (MARKETPLACE_SORT_PRIORITY[b.marketplace] ?? 99);
      if (marketplaceDiff !== 0) return marketplaceDiff;
      return firstSeenTime(b) - firstSeenTime(a);
    });
  } else if (sortMode === "name") {
    sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
  }
  return sorted;
}

function applyFilter() {
  const q = normalizeSearch(document.getElementById("search").value);
  const filtered = allProducts.filter(p => {
    const matchesStatus = activeStatuses.has(p.status);
    // Igual que matchesCategory/matchesGame: si la página no tiene checkboxes
    // de tienda (solo Pokémon TCG y Ofertas los llevan), el filtro no debe
    // aplicarse — si no, activeMarketplaces queda vacío y .has() nunca es
    // true, dejando la página sin productos aunque haya stock real.
    const matchesMarketplace = ALL_MARKETPLACES.length === 0 || activeMarketplaces.has(p.marketplace);
    // Si la página no tiene checkboxes de categoría (ej. Ofertas, que
    // mezcla los esquemas de dos juegos distintos), ALL_CATEGORIES está
    // vacío y el filtro no debe aplicarse en absoluto. Los productos de
    // accesorios (check_accessories.py) tampoco llevan campo "categories"
    // en absoluto salvo que sean de One Piece — sin ese bypass, el filtro
    // de categoría dejaba la página de Accesorios completamente vacía.
    const matchesCategory = ALL_CATEGORIES.length === 0 || !p.categories || p.categories.some(c => activeCategories.has(c));
    const matchesGame = ALL_GAMES.length === 0 || !p.game || activeGames.has(p.game);
    const matchesSearch = !q || normalizeSearch(p.name).includes(q);
    const matchesDiscount = discountPercent(p) >= minDiscount;
    const price = parsePrice(p.price);
    const matchesPrice = maxPrice === catalogPriceMax || (price !== null && price <= maxPrice);
    return matchesStatus && matchesMarketplace && matchesCategory && matchesGame && matchesSearch && matchesDiscount && matchesPrice;
  });
  if (filtersReady) writeFilterUrl();
  render(sortProducts(filtered));
  renderActiveFilters();
}

const ALL_STATUSES = ["compra_directa", "invitacion", "preventa"];
const ALL_MARKETPLACES = [...document.querySelectorAll(".sidebar input[data-marketplace]")].map(cb => cb.dataset.marketplace);
const ALL_GAMES = [...document.querySelectorAll(".sidebar input[data-game]")].map(cb => cb.dataset.game);
const ALL_CATEGORIES = [...document.querySelectorAll(".sidebar input[data-category]")].map(cb => cb.dataset.category);
const STATUS_FILTER_LABEL = { compra_directa: "Disponible", invitacion: "Invitación", preventa: "Preventa" };
const MARKETPLACE_FILTER_LABEL = { ES: "Amazon ES", UK: "Amazon UK", US: "Amazon USA", ECI: "El Corte Inglés", CAR: "Carrefour", FNAC: "Fnac", TRU: 'Toys"R"Us', GAME: "GAME" };

function renderActiveFilters() {
  const container = document.getElementById("active-filters");
  const chips = [];

  const searchInput = document.getElementById("search");
  const searchValue = searchInput.value.trim();
  if (searchValue) {
    chips.push({
      label: `Buscar: "${escapeHtml(searchValue)}"`,
      onRemove: () => { searchInput.value = ""; applyFilter(); },
    });
  }

  if (activeStatuses.size < ALL_STATUSES.length) {
    const label = ALL_STATUSES.filter(s => activeStatuses.has(s)).map(s => STATUS_FILTER_LABEL[s]).join(", ") || "Ninguno";
    chips.push({
      label: `Tipo: ${label}`,
      onRemove: () => {
        ALL_STATUSES.forEach(s => activeStatuses.add(s));
        document.querySelectorAll(".sidebar input[data-status]").forEach(cb => { cb.checked = true; });
        applyFilter();
      },
    });
  }

  if (activeMarketplaces.size < ALL_MARKETPLACES.length) {
    const label = ALL_MARKETPLACES.filter(m => activeMarketplaces.has(m)).map(m => MARKETPLACE_FILTER_LABEL[m]).join(", ") || "Ninguna";
    chips.push({
      label: `Tienda: ${label}`,
      onRemove: () => {
        ALL_MARKETPLACES.forEach(m => activeMarketplaces.add(m));
        document.querySelectorAll(".sidebar input[data-marketplace]").forEach(cb => { cb.checked = true; });
        applyFilter();
      },
    });
  }

  if (activeGames.size < ALL_GAMES.length) {
    const label = ALL_GAMES.filter(g => activeGames.has(g)).join(", ") || "Ninguno";
    chips.push({
      label: `Juego: ${label}`,
      onRemove: () => {
        ALL_GAMES.forEach(g => activeGames.add(g));
        document.querySelectorAll(".sidebar input[data-game]").forEach(cb => { cb.checked = true; });
        applyFilter();
      },
    });
  }

  if (activeCategories.size < ALL_CATEGORIES.length) {
    const label = ALL_CATEGORIES.filter(c => activeCategories.has(c)).join(", ") || "Ninguna";
    chips.push({
      label: `Categoría: ${label}`,
      onRemove: () => {
        ALL_CATEGORIES.forEach(c => activeCategories.add(c));
        document.querySelectorAll(".sidebar input[data-category]").forEach(cb => { cb.checked = true; });
        applyFilter();
      },
    });
  }

  const discountFloor = Number(discountRangeEl.min) || 0;
  if (minDiscount > discountFloor) {
    chips.push({
      label: `Descuento mínimo: ${minDiscount}%`,
      onRemove: () => {
        minDiscount = discountFloor;
        discountRangeEl.value = discountFloor;
        discountValue.textContent = `${discountFloor}% de descuento`;
        applyFilter();
      },
    });
  }

  if (maxPrice !== catalogPriceMax) {
    chips.push({
      label: `Hasta ${maxPrice} €`,
      onRemove: () => {
        maxPrice = catalogPriceMax;
        priceRange.max = catalogPriceMax;
        priceInput.max = catalogPriceMax;
        priceRange.value = maxPrice;
        priceInput.value = maxPrice;
        applyFilter();
      },
    });
  }

  if (!chips.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = chips
    .map((c, i) => `<span class="filter-chip" data-chip-index="${i}">${c.label}<button type="button" aria-label="Quitar filtro">×</button></span>`)
    .join("");
  [...container.children].forEach((el, i) => {
    el.querySelector("button").addEventListener("click", () => chips[i].onRemove());
  });
}

document.getElementById("search").addEventListener("input", applyFilter);

sortSelectEl.addEventListener("change", (e) => {
  sortMode = e.target.value;
  applyFilter();
});

const discountValue = document.getElementById("discount-value");
discountRangeEl.addEventListener("input", (e) => {
  minDiscount = Number(e.target.value);
  discountValue.textContent = `${minDiscount}% de descuento`;
  applyFilter();
});

const priceRange = document.getElementById("price-range");
const priceInput = document.getElementById("price-input");
priceRange.addEventListener("input", (e) => {
  maxPrice = Number(e.target.value);
  priceInput.value = maxPrice;
  priceInput.removeAttribute("aria-invalid");
  applyFilter();
});

priceInput.addEventListener("input", () => {
  const value = Number(priceInput.value);
  if (!Number.isFinite(value) || value < 0 || priceInput.value.trim() === "") {
    priceInput.setAttribute("aria-invalid", "true");
    return;
  }
  priceInput.removeAttribute("aria-invalid");
  maxPrice = Math.round(value * 100) / 100;
  priceRange.max = Math.max(catalogPriceMax, maxPrice);
  priceInput.max = priceRange.max;
  priceRange.value = maxPrice;
  applyFilter();
});
priceInput.addEventListener("change", () => {
  priceInput.value = maxPrice;
  priceInput.removeAttribute("aria-invalid");
});

function setupCheckboxGroup(containerSelector, dataAttr, activeSet) {
  document.querySelectorAll(`${containerSelector} input[data-${dataAttr}]`).forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const value = checkbox.dataset[dataAttr];
      if (checkbox.checked) {
        activeSet.add(value);
      } else {
        activeSet.delete(value);
      }
      applyFilter();
    });
  });
}

setupCheckboxGroup(".sidebar", "status", activeStatuses);
setupCheckboxGroup(".sidebar", "marketplace", activeMarketplaces);
setupCheckboxGroup(".sidebar", "category", activeCategories);
setupCheckboxGroup(".sidebar", "game", activeGames);

const resultCount = document.getElementById("count");
resultCount.setAttribute("role", "status");
resultCount.setAttribute("aria-live", "polite");
const resetButton = document.createElement("button");
resetButton.type = "button";
resetButton.className = "utility-button";
resetButton.id = "reset-filters";
resetButton.textContent = "Limpiar filtros";
resetButton.addEventListener("click", resetFilters);
resultCount.after(resetButton);
const grid = document.getElementById("grid");
const viewButtons = document.querySelectorAll(".view-btn");

function setView(view) {
  grid.classList.remove("view-3", "view-5", "view-list");
  grid.classList.add(view);
  viewButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  try { localStorage.setItem("wts-view-2", view); } catch (e) {}
}

viewButtons.forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

// "wts-view-2", no "wts-view": al cambiar el default de 3 a 5 columnas
// (2026-09-06), quien ya tuviera "wts-view" guardado seguiría viendo 3
// columnas para siempre sin saber por qué — la clave nueva ignora ese
// valor antiguo una sola vez y a partir de ahí vuelve a recordar el
// toggle con normalidad.
try {
  const savedView = localStorage.getItem("wts-view-2");
  if (savedView) setView(savedView);
} catch (e) {}

const layoutEl = document.querySelector(".layout");
const filterToggleBtn = document.getElementById("filter-toggle");
const mobileFilters = window.matchMedia("(max-width: 860px)");
const sidebar = document.querySelector(".sidebar");
sidebar.id = "stock-filters";
filterToggleBtn.setAttribute("aria-controls", sidebar.id);
const sidebarPreferenceKey = () => mobileFilters.matches ? "wts-sidebar-mobile" : "wts-sidebar";

function setSidebarVisible(visible) {
  layoutEl.classList.toggle("sidebar-hidden", !visible);
  filterToggleBtn.textContent = visible ? "Ocultar filtros" : "Filtrar productos";
  filterToggleBtn.setAttribute("aria-expanded", String(visible));
  try { localStorage.setItem(sidebarPreferenceKey(), visible ? "visible" : "hidden"); } catch (e) {}
}

filterToggleBtn.addEventListener("click", () => {
  setSidebarVisible(layoutEl.classList.contains("sidebar-hidden"));
});

function restoreSidebar() {
  try {
    const saved = localStorage.getItem(sidebarPreferenceKey());
    setSidebarVisible(saved ? saved === "visible" : !mobileFilters.matches);
  } catch {
    setSidebarVisible(!mobileFilters.matches);
  }
}
restoreSidebar();
mobileFilters.addEventListener("change", restoreSidebar);

// La mayoría de páginas leen un solo archivo (data-products-url). Ofertas
// combina varios juegos a la vez (data-products-urls, separados por coma)
// para poder mostrar y filtrar por "Juego" en un mismo listado.
const PRODUCTS_URLS = document.body.dataset.productsUrls
  ? document.body.dataset.productsUrls.split(",").map(u => u.trim())
  : [document.body.dataset.productsUrl || "products.json"];

function loadCatalog() {
resetButton.disabled = true;
return Promise.allSettled(PRODUCTS_URLS.map(fetchStock))
  .then(results => {
    updateStockLabel(PRODUCTS_URLS, results);
    const okResults = results.filter(r => r.status === "fulfilled").map(r => r.value);
    if (!okResults.length) throw new Error("Ningún origen de productos cargó correctamente");

    // "_src" (qué archivo JSON trajo este producto) viaja con cada producto
    // para poder reconstruir el enlace a su página individual (producto.html)
    // más tarde, sin tener que adivinar de dónde vino cada uno.
    allProducts = results.flatMap((r, i) =>
      r.status === "fulfilled" ? (r.value.products || []).map(p => ({ ...p, _src: PRODUCTS_URLS[i] })) : []
    );

    const prices = allProducts.map(p => parsePrice(p.price)).filter(v => v !== null);
    const dataMax = prices.length ? Math.ceil(Math.max(...prices) / 5) * 5 : 200;
    priceRange.max = dataMax;
    priceRange.value = dataMax;
    priceInput.max = dataMax;
    priceInput.value = dataMax;
    catalogPriceMax = dataMax;
    restoreFilterUrl();
    filtersReady = true;
    resetButton.disabled = false;

    applyFilter();
  })
  .catch(() => {
    document.getElementById("live-text").textContent = "sin datos";
    document.getElementById("empty").style.display = "block";
    document.getElementById("empty").innerHTML = '<p>No se pudo cargar el listado de productos.</p><button type="button" class="utility-button" id="retry-catalog">Reintentar</button>';
    document.getElementById("retry-catalog").addEventListener("click", event => { event.target.disabled = true; loadCatalog(); });
  });

}
loadCatalog();
