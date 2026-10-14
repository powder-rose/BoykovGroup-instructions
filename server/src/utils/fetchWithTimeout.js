export class ExternalHttpTimeoutError extends Error {
  constructor(message, { code = 'EXTERNAL_HTTP_TIMEOUT', timeoutMs, cause } = {}) {
    super(message, {
      cause,
    });

    this.name = 'ExternalHttpTimeoutError';

    this.code = code;

    this.timeoutMs = timeoutMs;
  }
}

export async function fetchWithTimeout(
  fetchImplementation,
  url,
  options = {},
  { timeoutMs, timeoutCode = 'EXTERNAL_HTTP_TIMEOUT' } = {},
) {
  if (typeof fetchImplementation !== 'function') {
    throw new TypeError('fetchImplementation must be a function');
  }

  const normalizedTimeoutMs = Number(timeoutMs);

  if (!Number.isFinite(normalizedTimeoutMs) || normalizedTimeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }

  const controller = new AbortController();

  const externalSignal = options?.signal ?? null;

  let timedOut = false;

  const forwardExternalAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort(externalSignal?.reason);
    }
  };

  if (externalSignal?.aborted) {
    forwardExternalAbort();
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', forwardExternalAbort, {
      once: true,
    });
  }

  const timer = setTimeout(() => {
    timedOut = true;

    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, normalizedTimeoutMs);

  try {
    return await fetchImplementation(url, {
      ...options,

      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ExternalHttpTimeoutError(
        `External HTTP request timed out after ${normalizedTimeoutMs} ms`,
        {
          code: timeoutCode,

          timeoutMs: normalizedTimeoutMs,

          cause: error,
        },
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);

    if (externalSignal) {
      externalSignal.removeEventListener('abort', forwardExternalAbort);
    }
  }
}
