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
