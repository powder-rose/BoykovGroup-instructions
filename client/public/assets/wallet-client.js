export function formatRubles(minor) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function walletPaymentUrl(instructionId, topupId) {
  const query = new URLSearchParams();
  if (instructionId) query.set('instruction', instructionId);
  if (topupId) query.set('topup', topupId);
  return `/oplata-instrukcii${query.size ? `?${query}` : ''}`;
}

export async function walletRequest(
  token,
  endpoint = '',
  { baseUrl = '', body, signal, pdf = false } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 45_000);
  try {
    const response = await fetch(`${baseUrl}/api/account/wallet${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: pdf ? 'application/pdf' : 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Object.assign(
        new Error(data.error || 'Не удалось выполнить запрос. Попробуйте ещё раз.'),
        { code: data.code, status: response.status },
      );
    }
    if (!pdf) return await response.json();
    if (!response.headers.get('content-type')?.includes('application/pdf'))
      throw new Error('Не удалось получить PDF. Покупка сохранена в личном кабинете.');
    const blob = await response.blob();
    if (blob.size < 1000 || (await blob.slice(0, 4).text()) !== '%PDF')
      throw new Error('Не удалось получить PDF. Попробуйте скачать его ещё раз.');
    return blob;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function downloadPurchasedInstruction(token, purchaseId, options = {}) {
  const blob = await walletRequest(token, `/purchases/${encodeURIComponent(purchaseId)}/pdf`, {
    ...options,
    pdf: true,
  });
  if (options.signal?.aborted) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'instruction.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
