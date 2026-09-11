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
  // Un solo array compartido: el trigger de cada desplegable hace
  // stopPropagation() en su propio click (para que el listener de "click
  // fuera cierra esto" no se dispare sobre sí mismo), lo que también le
  // impide llegar a document — así que el cierre de los DEMÁS desplegables
  // no puede delegarse en ese listener global y hay que hacerlo a mano
  // aquí antes de abrir el propio.
  const dropdowns = [];

  document.querySelectorAll(".topnav-dropdown").forEach(dd => {
    const trigger = dd.querySelector(".topnav-dropdown-trigger");
    const menu = dd.querySelector(".topnav-dropdown-menu");
    if (!trigger || !menu) return;

    function close() {
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
    function open() {
      dropdowns.forEach(other => other !== entry && other.close());
      // position: fixed (ver styles.css) necesita coordenadas de
      // viewport puestas a mano. Pegado del todo (sin hueco) para que
      // se vea como una continuación del botón, no una tarjeta flotante.
      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom}px`;
      menu.style.left = `${rect.left}px`;
      trigger.setAttribute("aria-expanded", "true");
      menu.hidden = false;
    }

    const entry = { close };
    dropdowns.push(entry);

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
