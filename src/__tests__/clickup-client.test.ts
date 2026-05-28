import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickupGet, __resetThrottleStateForTest } from '../clickup-client.js';

describe('clickupGet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    __resetThrottleStateForTest();
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('rate', { status: 429 })
    );
    const promise = clickupGet('/x', {}, 'pk').catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toMatch(/429/);
  });

  it('retries once on 5xx, then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('oops', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const promise = clickupGet<{ ok: number }>('/y', {}, 'pk');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toEqual({ ok: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('fails immediately on 401 without retry', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad', { status: 401 }));
    await expect(clickupGet('/y', {}, 'pk')).rejects.toThrow(/401/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throttles back-to-back calls by RATE_LIMIT_MS', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({}), { status: 200 })
    );
    const p1 = clickupGet('/a', {}, 'pk');
    await vi.advanceTimersByTimeAsync(0);
    await p1;
    const start = Date.now();
    const p2 = clickupGet('/b', {}, 'pk');
    await vi.advanceTimersByTimeAsync(700);
    await p2;
    expect(Date.now() - start).toBeGreaterThanOrEqual(700);
  });

  it('serializes array query params with [] suffix', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await clickupGet('/z', { project_ids: ['1', '2'] }, 'pk');
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('project_ids%5B%5D=1');
    expect(url).toContain('project_ids%5B%5D=2');
  });

  it('retries once on network/timeout error, then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const promise = clickupGet<{ ok: number }>('/n', {}, 'pk');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await promise).toEqual({ ok: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after a second network/timeout error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('aborted', 'AbortError')
    );
    const promise = clickupGet('/n', {}, 'pk').catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toMatch(/Network\/timeout/);
  });
});
