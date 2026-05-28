import { describe, expect, it } from 'vitest';
import { aggregate } from '../aggregate.js';
import { PANELS } from '../config.js';
import type { RawTask, FolderTotals } from '../types.js';
import fixture from './fixtures/sample-raw-tasks.json' assert { type: 'json' };

const MUNICIPAL = PANELS.find((p) => p.slug === 'municipal')!;
const NOW = new Date('2026-05-28T07:00:00Z'); // 04:00 BRT
const TOTALS: FolderTotals = { total: 6710, admJudicial: 3643, cumprSentenca: 3067 };

describe('aggregate (municipal)', () => {
  it('separates day (D+1) from week (D+1..D+6) subtasks, dedupes by id, drops parent=null', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // After dedupe t1, drop t5 (parent null): unique IDs = t1, t2, t3, t4
    // day = t1, t2, t4 = 3
    // week = day + t3 = 4
    expect(data.kpis.subtarefasDia).toBe(3);
    expect(data.kpis.subtarefasSemana).toBe(4);
  });
});
