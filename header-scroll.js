(function () {
  const header = document.querySelector("header");
  if (!header) return;

  let lastScrollY = window.scrollY;
  const threshold = 10;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (Math.abs(currentScrollY - lastScrollY) < threshold) return;

    if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) {
      header.classList.add("header-hidden");
    } else {
      header.classList.remove("header-hidden");
    }
    lastScrollY = currentScrollY;
  }, { passive: true });
})();

(function () {
  document.querySelectorAll(".topnav-dropdown").forEach(dd => {
    const trigger = dd.querySelector(".topnav-dropdown-trigger");
    const menu = dd.querySelector(".topnav-dropdown-menu");
    if (!trigger || !menu) return;

    function close() {
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
    function open() {
      // position: fixed (ver styles.css) necesita coordenadas de
      // viewport puestas a mano. Pegado del todo (sin hueco) para que
      // se vea como una continuación del botón, no una tarjeta flotante.
      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom}px`;
      menu.style.left = `${rect.left}px`;
      trigger.setAttribute("aria-expanded", "true");
      menu.hidden = false;
    }

    trigger.addEventListener("click", e => {
      e.stopPropagation();
      trigger.getAttribute("aria-expanded") === "true" ? close() : open();
    });
    document.addEventListener("click", e => {
      if (!dd.contains(e.target)) close();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
    });
    // Cierra en vez de reposicionar al hacer scroll — más simple que
    // recalcular top/left en cada evento de scroll.
    window.addEventListener("scroll", close, { passive: true });
  });
})();
