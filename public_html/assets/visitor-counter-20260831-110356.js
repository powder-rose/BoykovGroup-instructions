(() => {
  'use strict';
  function track() {
    import('/assets/visitor-tracking.js?v=traffic-filtering')
      .then(module => module.trackCurrentPage())
      .catch(() => {});
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      track();
      return result;
    };
  }
  window.addEventListener('popstate', track);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', track, { once: true });
  else track();
})();
