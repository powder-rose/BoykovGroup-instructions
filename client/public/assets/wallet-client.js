export function formatRubles(minor) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export const WALLET_UPDATED_EVENT = 'boykovdocs:wallet-updated';

export function notifyWalletUpdated(wallet = null) {
  window.dispatchEvent(
    new CustomEvent(WALLET_UPDATED_EVENT, {
      detail: wallet ? { balanceMinor: wallet.balanceMinor, priceMinor: wallet.priceMinor } : null,
    }),
  );
}

function downloadFormat(value = 'pdf') {
  if (value !== 'pdf' && value !== 'docx') throw new Error('Выберите PDF или Word.');
  return value;
}

export function walletPaymentUrl(instructionId, topupId, format = 'pdf') {
  const query = new URLSearchParams();
  if (instructionId) query.set('instruction', instructionId);
  if (topupId) query.set('topup', topupId);
  if (downloadFormat(format) === 'docx') query.set('format', 'docx');
  return `/oplata-instrukcii${query.size ? `?${query}` : ''}`;
}

export async function walletRequest(
  token,
  endpoint = '',
  { baseUrl = '', body, signal, pdf = false, documentFormat = null } = {},
) {
  const format = documentFormat ? downloadFormat(documentFormat) : pdf ? 'pdf' : null;
  const contentType =
    format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : format === 'pdf'
        ? 'application/pdf'
        : 'application/json';
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
        Accept: contentType,
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
    if (!format) return await response.json();
    const label = format === 'docx' ? 'Word' : 'PDF';
    if (!response.headers.get('content-type')?.includes(contentType))
      throw new Error(`Не удалось получить ${label}. Покупка сохранена в личном кабинете.`);
    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const expected = format === 'docx' ? [0x50, 0x4b, 0x03, 0x04] : [0x25, 0x50, 0x44, 0x46];
    if (blob.size < 1000 || expected.some((byte, index) => signature[index] !== byte))
      throw new Error(`Не удалось получить ${label}. Попробуйте скачать его ещё раз.`);
    return blob;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function purchaseCatalogInstruction(token, instructionId, options = {}) {
  const format = downloadFormat(options.format);
  if (format === 'docx' && options.confirmed !== true)
    throw new Error('Подтвердите покупку Word за 50 ₽.');
  const wallet = await walletRequest(token, '', options);
  if (
    !Number.isSafeInteger(wallet.balanceMinor) ||
    !Number.isSafeInteger(wallet.priceMinor) ||
    wallet.priceMinor <= 0
  ) {
    throw new Error('Не удалось проверить стоимость инструкции и баланс.');
  }
  const owned = wallet.purchases?.find(
    purchase => purchase.instructionId === instructionId && (purchase.format || 'pdf') === format,
  );
  if (owned) return { kind: 'purchased', purchaseId: owned.id, wallet };
  if (wallet.balanceMinor < wallet.priceMinor) return { kind: 'topup', wallet };

  const result = await walletRequest(token, '/purchases', {
    ...options,
    body: {
      instructionId,
      priceMinor: wallet.priceMinor,
      ...(format === 'docx' ? { format, confirmed: true } : {}),
    },
  });
  if (!result?.purchaseId) throw new Error('Покупка не подтверждена. Проверьте личный кабинет.');
  return { kind: 'purchased', purchaseId: result.purchaseId, wallet: result.wallet };
}

export async function downloadPurchasedInstruction(token, purchaseId, options = {}) {
  const format = downloadFormat(options.format);
  const blob = await walletRequest(
    token,
    `/purchases/${encodeURIComponent(purchaseId)}/${format}`,
    {
      ...options,
      documentFormat: format,
    },
  );
  if (options.signal?.aborted) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `instruction.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
