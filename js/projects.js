(() => {
  "use strict";

  const browser = document.querySelector("[data-project-browser]");
  if (!browser || browser.dataset.projectBrowserReady === "true") return;

  browser.dataset.projectBrowserReady = "true";

  const items = [...browser.querySelectorAll("[data-project-item][data-category]")];
  const filters = [...browser.querySelectorAll("[data-project-filter]")];
  const totalOutput = browser.querySelector("[data-project-total]");
  const visibleOutput = browser.querySelector("[data-visible-count]");
  const titleOutput = browser.querySelector("[data-project-heading-title]");

  const countFor = (category) => category === "all"
    ? items.length
    : items.filter((item) => item.dataset.category === category).length;

  if (totalOutput) totalOutput.textContent = String(items.length);

  filters.forEach((button) => {
    const count = countFor(button.dataset.projectFilter);
    const countOutput = button.querySelector("[data-project-count]");
    if (countOutput) countOutput.textContent = String(count).padStart(2, "0");
    button.hidden = button.dataset.projectFilter !== "all" && count === 0;
  });

  const showCategory = (category) => {
    const activeButton = filters.find((button) => button.dataset.projectFilter === category) || filters[0];
    if (!activeButton) return;

    let visibleCount = 0;
    items.forEach((item) => {
      const visible = category === "all" || item.dataset.category === category;
      item.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });

    filters.forEach((button) => {
      const active = button === activeButton;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (titleOutput) titleOutput.textContent = activeButton.dataset.filterTitle;
    if (visibleOutput) visibleOutput.textContent = String(visibleCount);
  };

  filters.forEach((button) => {
    button.addEventListener("click", () => showCategory(button.dataset.projectFilter));
  });

  showCategory("all");
})();
