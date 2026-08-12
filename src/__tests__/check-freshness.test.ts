import { describe, expect, it } from 'vitest';
import { assertFresh, parseGeneratedAt, MAX_AGE_MS } from '../check-freshness.js';

describe('check-freshness', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');

  it('parseGeneratedAt accepts ISO strings', () => {
    expect(parseGeneratedAt({ generatedAt: '2026-08-12T10:00:00.000Z' }, 'x.json')).toBe(
      '2026-08-12T10:00:00.000Z'
    );
  });

  it('parseGeneratedAt rejects missing or invalid values', () => {
    expect(() => parseGeneratedAt({}, 'x.json')).toThrow(/missing generatedAt/);
    expect(() => parseGeneratedAt({ generatedAt: 'nope' }, 'x.json')).toThrow(/not a valid date/);
  });

  it('assertFresh passes when within max age', () => {
    expect(() =>
      assertFresh(
        [{ path: 'docs/a.json', generatedAt: '2026-08-11T12:00:00.000Z' }],
        now,
        MAX_AGE_MS
      )
    ).not.toThrow();
  });

  it('assertFresh fails when older than max age', () => {
    expect(() =>
      assertFresh(
        [{ path: 'docs/a.json', generatedAt: '2026-08-10T11:00:00.000Z' }],
        now,
        MAX_AGE_MS
      )
    ).toThrow(/36h/);
  });
});
