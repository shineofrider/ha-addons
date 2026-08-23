(() => {
  const RELOAD_AFTER = 60 * 1000;
  let hiddenSince = null;

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenSince = Date.now();
      return;
    }

    if (document.visibilityState === "visible" && hiddenSince !== null) {
      const hiddenFor = Date.now() - hiddenSince;
      hiddenSince = null;
      if (hiddenFor >= RELOAD_AFTER) {
        window.location.reload();
      }
    }
  });
})();
