const SCRIPT_ID = 'cloudpayments-widget-script';
const SCRIPT_URL = 'https://widget.cloudpayments.ru/bundles/cloudpayments.js';
let loading = null;

export function loadCloudPayments() {
  if (window.cp?.CloudPayments) return Promise.resolve(window.cp);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement('script');
    const timer = window.setTimeout(failed, 15_000);
    function cleanup() {
      window.clearTimeout(timer);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    }
    function failed() {
      cleanup();
      script.remove();
      reject(new Error('Не удалось загрузить форму оплаты. Попробуйте ещё раз.'));
    }
    function loaded() {
      if (!window.cp?.CloudPayments) return failed();
      cleanup();
      resolve(window.cp);
    }
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.append(script);
    }
  }).finally(() => {
    loading = null;
  });
  return loading;
}
