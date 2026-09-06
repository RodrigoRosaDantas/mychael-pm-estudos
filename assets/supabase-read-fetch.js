const READ_OPTIONS = new Set([
  'method', 'headers', 'body', 'signal', 'cache', 'credentials', 'integrity',
  'keepalive', 'mode', 'redirect', 'referrer', 'referrerPolicy', 'priority'
]);

// Share only identical table reads that are still waiting for a response.
// The SDK supplies the final Authorization header before calling this fetch.
export function createReadFetch(projectUrl, fetchImpl = (...args) => globalThis.fetch(...args)) {
  const restUrl = new URL(`${projectUrl.replace(/\/$/, '')}/rest/v1/`);
  const pending = new Map();
  let writesInFlight = 0;
  const invalidate = () => pending.clear();

  async function fetch(input, init = {}) {
    // Request objects can carry a body or an independent cancellation signal.
    // Preserve their native behavior instead of trying to merge them.
    if (typeof input !== 'string' && !(input instanceof URL)) return fetchImpl(input, init);
    let url;
    try {
      url = new URL(input);
    } catch {
      return fetchImpl(input, init);
    }
    if (url.origin !== restUrl.origin || !url.pathname.startsWith(restUrl.pathname)) {
      return fetchImpl(input, init);
    }
    const method = (init.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      // Reads started before or during a write must not be reused after it.
      writesInFlight += 1;
      invalidate();
      try {
        return await fetchImpl(input, init);
      } finally {
        writesInFlight -= 1;
        invalidate();
      }
    }
    const table = url.pathname.slice(restUrl.pathname.length);
    if (!['GET', 'HEAD'].includes(method) || !table || table.includes('/') || table === 'rpc'
      || writesInFlight || init.signal || init.body != null
      || Object.keys(init).some((option) => !READ_OPTIONS.has(option))) {
      return fetchImpl(input, init);
    }

    const headers = [...new Headers(init.headers).entries()];
    const options = Object.keys(init).sort()
      .filter((key) => !['method', 'headers', 'body', 'signal'].includes(key))
      .map((key) => [key, init[key]]);
    // Include credentials, schema, range and every other header in the key.
    const key = JSON.stringify([url.href, method, headers, options]);
    let responsePromise = pending.get(key);
    if (!responsePromise) {
      responsePromise = Promise.resolve().then(() => fetchImpl(input, init)).finally(() => {
        if (pending.get(key) === responsePromise) pending.delete(key);
      });
      pending.set(key, responsePromise);
    }
    // Each consumer needs its own body, including for errors and count queries.
    return (await responsePromise).clone();
  }

  return { fetch, invalidate };
}
