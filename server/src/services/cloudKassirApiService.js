import { fiscalError, getFiscalConfiguration } from './fiscalReceiptPayload.js';

export function createCloudKassirApi({
  fetchImplementation = globalThis.fetch,
  env = process.env,
} = {}) {
  async function request(endpoint, data, { requestId, signal } = {}) {
    const configuration = getFiscalConfiguration(env);
    if (!configuration) throw fiscalError('FISCAL_DISABLED');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    // Keep the deadline active while reading the response body too.
    const timer = setTimeout(abort, 10000);
    try {
      const response = await fetchImplementation(`https://api.cloudpayments.ru/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${configuration.publicId}:${configuration.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json; charset=utf-8',
          ...(requestId ? { 'X-Request-ID': requestId } : {}),
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = fiscalError(`FISCAL_HTTP_${response.status}`);
        error.permanent =
          response.status >= 400 && response.status < 500 && response.status !== 429;
        throw error;
      }
      const result = await response.json();
      if (typeof result?.Success !== 'boolean') throw fiscalError('FISCAL_RESPONSE_INVALID');
      if (!result.Success) {
        const error = fiscalError('FISCAL_REQUEST_REJECTED');
        error.permanent = true;
        error.providerCode = Number.isInteger(result.Model?.ErrorCode)
          ? result.Model.ErrorCode
          : null;
        throw error;
      }
      return result;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    create: (payload, requestId, signal) => request('kkt/receipt', payload, { requestId, signal }),
    status: (id, signal) => request('kkt/receipt/status/get', { Id: id }, { signal }),
    test: () => request('test', {}),
    register: (deviceNumber, fiscalNumber) =>
      request('kkt/state/get', {
        DeviceNumber: deviceNumber,
        FiscalNumber: fiscalNumber,
      }),
  };
}
