let allProducts = [];

function render(products) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");
  if (!products.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    count.textContent = "";
    return;
  }
  empty.style.display = "none";
  count.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
  grid.innerHTML = products.map(cardHtml).join("");
}

const discountRangeEl = document.getElementById("discount-range");
const sortSelectEl = document.getElementById("sort-select");

let activeStatuses = new Set(["compra_directa", "invitacion", "preventa"]);
let activeMarketplaces = new Set(["ES", "UK", "US", "ECI"]);
// Las categorías varían según la página (Pokémon TCG, One Piece TCG,
// Accesorios...), así que se leen directamente de los checkboxes presentes
// en el sidebar en vez de una lista fija — activeCategories arranca con
// los que ya vienen marcados como "checked" en el HTML de cada página.
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
const MARKETPLACE_SORT_PRIORITY = { ES: 0, ECI: 1, US: 2, UK: 3 };

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
  const q = document.getElementById("search").value.trim().toLowerCase();
  const filtered = allProducts.filter(p => {
    const matchesStatus = activeStatuses.has(p.status);
    const matchesMarketplace = activeMarketplaces.has(p.marketplace);
    // Si la página no tiene checkboxes de categoría (ej. Ofertas, que
    // mezcla los esquemas de dos juegos distintos), ALL_CATEGORIES está
    // vacío y el filtro no debe aplicarse en absoluto. Los productos de
    // accesorios (check_accessories.py) tampoco llevan campo "categories"
    // en absoluto salvo que sean de One Piece — sin ese bypass, el filtro
    // de categoría dejaba la página de Accesorios completamente vacía.
    const matchesCategory = ALL_CATEGORIES.length === 0 || !p.categories || p.categories.some(c => activeCategories.has(c));
    const matchesGame = ALL_GAMES.length === 0 || !p.game || activeGames.has(p.game);
    const matchesSearch = !q || (p.name || "").toLowerCase().includes(q);
    const matchesDiscount = discountPercent(p) >= minDiscount;
    const price = parsePrice(p.price);
    const matchesPrice = price === null || price <= maxPrice;
    return matchesStatus && matchesMarketplace && matchesCategory && matchesGame && matchesSearch && matchesDiscount && matchesPrice;
  });
  render(sortProducts(filtered));
  renderActiveFilters();
}

const ALL_STATUSES = ["compra_directa", "invitacion", "preventa"];
const ALL_MARKETPLACES = ["ES", "UK", "US", "ECI"];
const ALL_GAMES = [...document.querySelectorAll(".sidebar input[data-game]")].map(cb => cb.dataset.game);
const ALL_CATEGORIES = [...document.querySelectorAll(".sidebar input[data-category]")].map(cb => cb.dataset.category);
const STATUS_FILTER_LABEL = { compra_directa: "Disponible", invitacion: "Invitación", preventa: "Preventa" };
const MARKETPLACE_FILTER_LABEL = { ES: "Amazon ES", UK: "Amazon UK", US: "Amazon USA", ECI: "El Corte Inglés" };

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

  if (maxPrice < Number(priceRange.max)) {
    chips.push({
      label: `Hasta ${maxPrice} €`,
      onRemove: () => {
        maxPrice = Number(priceRange.max);
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
  applyFilter();
});

priceInput.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  if (Number.isNaN(value)) return;
  maxPrice = value;
  const clamped = Math.min(value, Number(priceRange.max));
  priceRange.value = clamped;
  applyFilter();
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

Promise.allSettled(PRODUCTS_URLS.map(fetchStock))
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
    maxPrice = dataMax;

    applyFilter();
  })
  .catch(() => {
    document.getElementById("live-text").textContent = "sin datos";
    document.getElementById("empty").style.display = "block";
    document.getElementById("empty").textContent = "No se pudo cargar el listado de productos.";
  });
