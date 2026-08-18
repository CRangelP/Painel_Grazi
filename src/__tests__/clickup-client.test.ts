import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickupGet, __resetThrottleStateForTest } from '../clickup-client.js';
import { RATE_LIMIT_MS } from '../config.js';

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

  it('retries 5xx with exponential backoff (1s, 2s, 4s, 8s), then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('oops', { status: 500 }))
      .mockResolvedValueOnce(new Response('oops', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const promise = clickupGet<{ ok: number }>('/team/1/task', {}, 'pk');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await promise).toEqual({ ok: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries on persistent 5xx', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ err: 'Internal Server Error', ECODE: 'ITEMV2_003' }), {
          status: 500,
        })
    );
    const promise = clickupGet('/team/1/task', {}, 'pk').catch((e) => e);
    // 1s + 2s + 4s + 8s = 15s of backoff for 4 retries, then the 5th failure throws
    await vi.advanceTimersByTimeAsync(20_000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toMatch(
      /\[throttle\/API\/timeout\].*HTTP 500 after retries on \/team\/1\/task/
    );
    expect(String(err)).toMatch(/ITEMV2_003/);
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('does not retry non-retryable 4xx', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad request', { status: 400 }));
    await expect(clickupGet('/team/1/task', {}, 'pk')).rejects.toThrow(/HTTP 400/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fails immediately on 401 without retry', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad', { status: 401 }));
    await expect(clickupGet('/y', {}, 'pk')).rejects.toThrow(
      /\[auth\].*401.*token inválido/
    );
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
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_MS);
    await p2;
    expect(Date.now() - start).toBeGreaterThanOrEqual(RATE_LIMIT_MS);
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

  it('retries on network/timeout error, then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const promise = clickupGet<{ ok: number }>('/n', {}, 'pk');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toEqual({ ok: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting network/timeout retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('aborted', 'AbortError')
    );
    const promise = clickupGet('/n', {}, 'pk').catch((e) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toMatch(/\[throttle\/API\/timeout\].*AbortError/);
  });
});
