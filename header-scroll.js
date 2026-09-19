(function () {
  const header = document.querySelector("header");
  if (!header) return;

  let lastScrollY = window.scrollY;
  const threshold = 10;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (Math.abs(currentScrollY - lastScrollY) < threshold) return;

    if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight && !header.contains(document.activeElement)) {
      header.classList.add("header-hidden");
    } else {
      header.classList.remove("header-hidden");
    }
    lastScrollY = currentScrollY;
  }, { passive: true });
  header.addEventListener("focusin", () => header.classList.remove("header-hidden"));
})();

(function () {
  // Un solo array compartido: el trigger de cada desplegable hace
  // stopPropagation() en su propio click (para que el listener de "click
  // fuera cierra esto" no se dispare sobre sí mismo), lo que también le
  // impide llegar a document — así que el cierre de los DEMÁS desplegables
  // no puede delegarse en ese listener global y hay que hacerlo a mano
  // aquí antes de abrir el propio.
  const dropdowns = [];

  document.querySelectorAll(".topnav-dropdown").forEach((dd, index) => {
    const trigger = dd.querySelector(".topnav-dropdown-trigger");
    const menu = dd.querySelector(".topnav-dropdown-menu");
    if (!trigger || !menu) return;
    menu.id ||= `navigation-dropdown-${index}`;
    trigger.setAttribute("aria-controls", menu.id);
    // Disclosure navigation contains ordinary links, not an ARIA application menu.
    trigger.removeAttribute("aria-haspopup");

    function close(restoreFocus = false) {
      if (restoreFocus && menu.contains(document.activeElement)) trigger.focus({ preventScroll: true });
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
    function position() {
      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8))}px`;
    }
    function open() {
      dropdowns.forEach(other => other !== entry && other.close());
      // position: fixed (ver styles.css) necesita coordenadas de
      // viewport puestas a mano. Pegado del todo (sin hueco) para que
      // se vea como una continuación del botón, no una tarjeta flotante.
      trigger.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      position();
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
      if (e.key === "Escape" && !menu.hidden) close(true);
    });
    trigger.addEventListener("keydown", e => {
      if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
      e.preventDefault();
      open();
      const links = menu.querySelectorAll("a");
      (e.key === "ArrowDown" ? links[0] : links[links.length - 1])?.focus();
    });
    menu.addEventListener("keydown", e => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const links = [...menu.querySelectorAll("a")];
      const index = links.indexOf(document.activeElement);
      if (index < 0) return;
      e.preventDefault();
      const next = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1
        : (index + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links[next].focus();
    });
    dd.addEventListener("focusout", e => { if (!dd.contains(e.relatedTarget)) close(); });
    window.addEventListener("scroll", () => {
      if (menu.hidden) return;
      if (menu.contains(document.activeElement)) position();
      else close();
    }, { passive: true });
    window.addEventListener("resize", () => close(true));
  });
})();
