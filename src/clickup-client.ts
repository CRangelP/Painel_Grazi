import { CLICKUP_API_BASE, FETCH_TIMEOUT_MS } from './config.js';

export type QueryValue = string | number | boolean | string[];

let lastRequestAt = 0;

const MAX_RETRIES_429 = 3;

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
  const url = buildUrl(path, query);
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
    const res = await fetchOnce(url, token);
    lastRequestAt = Date.now();
    if (res.status === 429) {
      lastStatus = 429;
      try { lastBody = await res.text(); } catch { lastBody = ''; }
      if (attempt < MAX_RETRIES_429) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      break;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
  throw new Error(`HTTP ${lastStatus} after retries: ${lastBody}`);
}
