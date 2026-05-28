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

  it('retries 3 times on 429 with exponential backoff (1s, 2s, 4s)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));

    const promise = clickupGet<{ ok: number }>('/x', {}, 'pk');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual({ ok: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries on persistent 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate', { status: 429 }));
    const promise = clickupGet('/x', {}, 'pk').catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toMatch(/429/);
  });
});
