const STORAGE_KEY = 'boykovdocs_visitor_id_v1';
const GLOBAL_KEY = '__boykovdocsVisitorTrackingV2';

export function trackingPageKey(location) {
  const url = new URL(location.href);
  if (/^\/(?:api|assets|account|admin|thanks|oplata-instrukcii)(?:\/|$)/u.test(url.pathname))
    return null;
  const page = url.searchParams.get('page');
  return (
    url.pathname +
    (page && /^[1-9]\d{0,5}$/u.test(page) && Number(page) > 1 ? `?page=${Number(page)}` : '')
  );
}

export function createVisitorTracker(browser, { now = Date.now } = {}) {
  let lastPage = null,
    session = null,
    sessionPromise = null,
    memoryVisitor = null,
    sequence = 0;
  const controller = new browser.AbortController();
  function randomId() {
    return (
      browser.crypto?.randomUUID?.().replace(/-/gu, '_') ||
      `${now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
    );
  }
  function visitorId() {
    if (memoryVisitor) return memoryVisitor;
    try {
      const existing = browser.localStorage.getItem(STORAGE_KEY);
      memoryVisitor = /^[a-zA-Z0-9_-]{16,128}$/u.test(existing || '') ? existing : randomId();
      browser.localStorage.setItem(STORAGE_KEY, memoryVisitor);
    } catch {
      memoryVisitor = randomId();
    }
    return memoryVisitor;
  }
  function eligible() {
    if (
      controller.signal.aborted ||
      browser.navigator.webdriver === true ||
      browser.document.prerendering ||
      browser.document.visibilityState !== 'visible'
    )
      return false;
    try {
      if (
        browser.localStorage.getItem('boykovgroup_admin_token') ||
        browser.sessionStorage.getItem('boykovgroup_active_auth_role') === 'admin'
      )
        return false;
      if (browser.top !== browser.self) return false;
    } catch {
      return false;
    }
    return true;
  }
  async function getReceipt(refresh = false) {
    if (!refresh && session && session.expiresAt > now() + 60000) return session.receipt;
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const response = await browser.fetch('/api/visitor-stats/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: visitorId() }),
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (response.status !== 200) throw new Error('Tracking unavailable');
        const value = await response.json();
        if (typeof value.receipt !== 'string' || !Number.isFinite(value.expiresAt))
          throw new Error('Tracking unavailable');
        session = value;
        return value.receipt;
      })().finally(() => {
        sessionPromise = null;
      });
    }
    return sessionPromise;
  }
  async function track() {
    if (!eligible()) return false;
    const page = trackingPageKey(browser.location);
    if (!page || page === lastPage) return false;
    const current = ++sequence;
    const previousPage = lastPage;
    lastPage = page;
    const eventId = randomId();
    try {
      let receipt = await getReceipt();
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!eligible() || current !== sequence || trackingPageKey(browser.location) !== page) {
          if (sequence === current) lastPage = previousPage;
          return false;
        }
        try {
          const response = await browser.fetch('/api/visitor-stats/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schema: 2,
              eventId,
              receipt,
              path: page,
              visible: true,
              automated: false,
            }),
            credentials: 'same-origin',
            keepalive: true,
            cache: 'no-store',
          });
          if (response.status === 204) return true;
          if (attempt === 0 && (response.status === 401 || response.status === 403)) {
            receipt = await getReceipt(true);
            continue;
          }
          if (response.status < 500 || attempt > 0) return false;
        } catch {
          if (attempt > 0) throw new Error('Tracking unavailable');
        }
      }
    } catch {
      if (sequence === current) lastPage = previousPage;
    }
    return false;
  }
  function whenVisible() {
    void track();
  }
  browser.document.addEventListener('visibilitychange', whenVisible, { signal: controller.signal });
  browser.document.addEventListener('prerenderingchange', whenVisible, {
    signal: controller.signal,
  });
  return {
    track,
    dispose() {
      controller.abort();
    },
  };
}

export function trackCurrentPage() {
  window[GLOBAL_KEY] ||= createVisitorTracker(window);
  return window[GLOBAL_KEY].track();
}
