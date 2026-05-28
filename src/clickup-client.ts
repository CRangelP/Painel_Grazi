import { CLICKUP_API_BASE, FETCH_TIMEOUT_MS, RATE_LIMIT_MS } from './config.js';

export type QueryValue = string | number | boolean | string[];

let lastRequestAt = 0;

const MAX_RETRIES_429 = 3;
const RETRY_5XX_DELAY_MS = 5000;

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
  let did5xxRetry = false;

  while (true) {
    const res = await fetchOnce(url, token);
    lastRequestAt = Date.now();

    if (res.status === 429) {
      if (attempt429 < MAX_RETRIES_429) {
        await sleep(1000 * 2 ** attempt429);
        attempt429++;
        continue;
      }
      throw new Error(`HTTP 429 after retries: ${await res.text()}`);
    }

    if (res.status >= 500) {
      if (!did5xxRetry) {
        did5xxRetry = true;
        await sleep(RETRY_5XX_DELAY_MS);
        continue;
      }
      throw new Error(`HTTP ${res.status} after retry: ${await res.text()}`);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
}
