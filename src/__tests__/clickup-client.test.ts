import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickupGet } from '../clickup-client.js';

describe('clickupGet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('parses 200 JSON response and sends auth header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const promise = clickupGet<{ ok: boolean }>('/foo', { x: '1' }, 'pk_test');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('/foo?x=1');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'pk_test',
      'Content-Type': 'application/json',
    });
  });
});
