const SCRIPT_ID = 'cloudpayments-widget-script';

const SCRIPT_URL = 'https://widget.cloudpayments.ru/bundles/cloudpayments.js';

export function loadCloudPayments() {
  if (window.cp?.CloudPayments) {
    return Promise.resolve(window.cp);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);

    const handleLoaded = () => {
      if (window.cp?.CloudPayments) {
        resolve(window.cp);

        return;
      }

      reject(new Error('CloudPayments не инициализирован'));
    };

    if (existing) {
      existing.addEventListener('load', handleLoaded, {
        once: true,
      });

      existing.addEventListener(
        'error',
        () => {
          reject(new Error('Не удалось загрузить форму оплаты'));
        },
        {
          once: true,
        },
      );

      return;
    }

    const script = document.createElement('script');

    script.id = SCRIPT_ID;

    script.src = SCRIPT_URL;

    script.async = true;

    script.addEventListener('load', handleLoaded, {
      once: true,
    });

    script.addEventListener(
      'error',
      () => {
        reject(new Error('Не удалось загрузить форму оплаты'));
      },
      {
        once: true,
      },
    );

    document.head.appendChild(script);
  });
}
