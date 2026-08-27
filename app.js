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

let activeStatuses = new Set(["compra_directa", "invitacion"]);
let activeMarketplaces = new Set(["ES", "UK", "US", "ECI"]);
let activeCategories = new Set(["Sobres", "Cajas ETB", "Cajas de Colección", "Colecciones premium", "Latas", "Otros"]);
let minDiscount = discountRangeEl ? Number(discountRangeEl.value) || 0 : 0;
let maxPrice = Infinity;
let sortMode = sortSelectEl ? sortSelectEl.value : "newest";

function sortProducts(products) {
  const sorted = products.slice();
  if (sortMode === "price-asc") {
    sorted.sort((a, b) => (parsePrice(a.price) ?? Infinity) - (parsePrice(b.price) ?? Infinity));
  } else if (sortMode === "price-desc") {
    sorted.sort((a, b) => (parsePrice(b.price) ?? -Infinity) - (parsePrice(a.price) ?? -Infinity));
  } else if (sortMode === "discount") {
    sorted.sort((a, b) => discountPercent(b) - discountPercent(a));
  } else if (sortMode === "newest") {
    sorted.sort((a, b) => firstSeenTime(b) - firstSeenTime(a));
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
    // Los productos de accesorios (check_accessories.py) no llevan campo
    // "categories" en absoluto — solo el catálogo TCG lo tiene. Sin esto,
    // el filtro de categoría (pensado solo para pokemontcg/ofertas) dejaba
    // la página de Accesorios TCG completamente vacía.
    const matchesCategory = !p.categories || p.categories.some(c => activeCategories.has(c));
    const matchesSearch = !q || (p.name || "").toLowerCase().includes(q);
    const matchesDiscount = discountPercent(p) >= minDiscount;
    const price = parsePrice(p.price);
    const matchesPrice = price === null || price <= maxPrice;
    return matchesStatus && matchesMarketplace && matchesCategory && matchesSearch && matchesDiscount && matchesPrice;
  });
  render(sortProducts(filtered));
  renderActiveFilters();
}

const ALL_STATUSES = ["compra_directa", "invitacion"];
const ALL_MARKETPLACES = ["ES", "UK", "US", "ECI"];
const ALL_CATEGORIES = ["Sobres", "Cajas ETB", "Cajas de Colección", "Colecciones premium", "Latas", "Otros"];
const STATUS_FILTER_LABEL = { compra_directa: "Disponible", invitacion: "Invitación" };
const MARKETPLACE_FILTER_LABEL = { ES: "Amazon ES", UK: "Amazon UK", US: "Amazon USA", ECI: "El Corte Inglés" };

function renderActiveFilters() {
  const container = document.getElementById("active-filters");
  const chips = [];

  const searchInput = document.getElementById("search");
  const searchValue = searchInput.value.trim();
  if (searchValue) {
    chips.push({
      label: `Buscar: "${searchValue}"`,
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

  const discountFloor = Number(discountRange.min) || 0;
  if (minDiscount > discountFloor) {
    chips.push({
      label: `Descuento mínimo: ${minDiscount}%`,
      onRemove: () => {
        minDiscount = discountFloor;
        discountRange.value = discountFloor;
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

document.getElementById("sort-select").addEventListener("change", (e) => {
  sortMode = e.target.value;
  applyFilter();
});

const discountRange = document.getElementById("discount-range");
const discountValue = document.getElementById("discount-value");
discountRange.addEventListener("input", (e) => {
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

const grid = document.getElementById("grid");
const viewButtons = document.querySelectorAll(".view-btn");

function setView(view) {
  grid.classList.remove("view-3", "view-5", "view-list");
  grid.classList.add(view);
  viewButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  try { localStorage.setItem("wts-view", view); } catch (e) {}
}

viewButtons.forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

try {
  const savedView = localStorage.getItem("wts-view");
  if (savedView) setView(savedView);
} catch (e) {}

const layoutEl = document.querySelector(".layout");
const filterToggleBtn = document.getElementById("filter-toggle");

function setSidebarVisible(visible) {
  layoutEl.classList.toggle("sidebar-hidden", !visible);
  filterToggleBtn.textContent = visible ? "Ocultar filtros" : "Mostrar filtros";
  try { localStorage.setItem("wts-sidebar", visible ? "visible" : "hidden"); } catch (e) {}
}

filterToggleBtn.addEventListener("click", () => {
  setSidebarVisible(layoutEl.classList.contains("sidebar-hidden"));
});

try {
  setSidebarVisible(localStorage.getItem("wts-sidebar") !== "hidden");
} catch (e) {
  setSidebarVisible(true);
}

const PRODUCTS_URL = document.body.dataset.productsUrl || "products.json";

fetch(PRODUCTS_URL + "?t=" + Date.now())
  .then(r => r.json())
  .then(data => {
    allProducts = data.products || [];
    document.getElementById("live-text").textContent = timeAgo(data.updated_at);

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
