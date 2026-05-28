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

  it('groups by normalized status (trim + uppercase), maps complexity', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    const row = data.tasksDay.find((r) => r.status === 'VERIFICAR ANDAMENTO');
    expect(row).toBeDefined();
    expect(row!.count).toBe(2);
    expect(row!.complexity).toBe('baixa');
  });

  it('puts non-canon status into Outros with neutra', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    const outros = data.tasksDay.find((r) => r.status === 'Outros');
    expect(outros).toBeDefined();
    expect(outros!.count).toBe(1);
    expect(outros!.complexity).toBe('neutra');
  });

  it('orders tasksDay by count desc, Outros last', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    const lastRow = data.tasksDay[data.tasksDay.length - 1];
    expect(lastRow?.status).toBe('Outros');
  });

  it('computes perPerson as round(count / teamSize)', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    const row = data.tasksDay.find((r) => r.status === 'VERIFICAR ANDAMENTO');
    // 2 / 17 = 0.117 -> 0
    expect(row!.perPerson).toBe(0);
  });
});
