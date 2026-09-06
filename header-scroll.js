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
  });
})();
