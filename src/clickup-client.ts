import { CLICKUP_API_BASE, FETCH_TIMEOUT_MS } from './config.js';

export type QueryValue = string | number | boolean | string[];

let lastRequestAt = 0;

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

export async function clickupGet<T>(
  path: string,
  query: Record<string, QueryValue>,
  token: string
): Promise<T> {
  const url = buildUrl(path, query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
    lastRequestAt = Date.now();
  }
}
