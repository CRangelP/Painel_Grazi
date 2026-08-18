import { CLICKUP_API_BASE, FETCH_TIMEOUT_MS, RATE_LIMIT_MS } from './config.js';

export type QueryValue = string | number | boolean | string[];

let lastRequestAt = 0;

const MAX_RETRIES_429 = 3;
const MAX_RETRIES_5XX = 4;
const MAX_RETRIES_NETWORK = 2;
const RETRY_5XX_BASE_MS = 1000;
const RETRY_NETWORK_DELAY_MS = 5000;

function buildUrl(path: string, query: Record<string, QueryValue>): string {
  const url = new URL(CLICKUP_API_BASE + path);
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(`${k}[]`, item);
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** @internal Resets throttle timestamp. For use in tests only. */
export function __resetThrottleStateForTest(): void {
  lastRequestAt = 0;
}

async function throttle(): Promise<void> {
  const gap = Date.now() - lastRequestAt;
  if (gap < RATE_LIMIT_MS && lastRequestAt > 0) {
    await sleep(RATE_LIMIT_MS - gap);
  }
}

async function fetchOnce(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function clickupGet<T>(
  path: string,
  query: Record<string, QueryValue>,
  token: string
): Promise<T> {
  await throttle();
  const url = buildUrl(path, query);
  let attempt429 = 0;
  let attempt5xx = 0;
  let attemptNetwork = 0;

  while (true) {
    let res: Response;
    try {
      res = await fetchOnce(url, token);
    } catch (err) {
      // Timeout (AbortError) or network failure. Retry a few times —
      // large folder queries can stall under ClickUp load.
      lastRequestAt = Date.now();
      if (attemptNetwork < MAX_RETRIES_NETWORK) {
        attemptNetwork++;
        await sleep(RETRY_NETWORK_DELAY_MS);
        continue;
      }
      const kind =
        err instanceof Error && err.name === 'AbortError'
          ? 'timeout (AbortError)'
          : 'network';
      throw new Error(
        `[throttle/API/timeout] ${kind} after retry on ${path}: ${String(err)}`
      );
    }
    lastRequestAt = Date.now();

    if (res.status === 429) {
      if (attempt429 < MAX_RETRIES_429) {
        await sleep(1000 * 2 ** attempt429);
        attempt429++;
        continue;
      }
      throw new Error(
        `[throttle/API/timeout] HTTP 429 after retries on ${path}: ${await res.text()}`
      );
    }

    if (res.status >= 500) {
      if (attempt5xx < MAX_RETRIES_5XX) {
        await sleep(RETRY_5XX_BASE_MS * 2 ** attempt5xx);
        attempt5xx++;
        continue;
      }
      throw new Error(
        `[throttle/API/timeout] HTTP ${res.status} after retries on ${path}: ${await res.text()}`
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `[auth] HTTP ${res.status}: token inválido ou revogado (ClickUp). Atualize CLICKUP_TOKEN. Body: ${await res.text()}`
      );
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
}
