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

  it('classifies by subtask NAME (accent/case/space-insensitive keyword), maps complexity', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // t1 "Verificar Andamento" + t2 "  verificar  andamento PROAD " both match /ANDAMENTO/
    const row = data.tasksDay.find((r) => r.status === 'VERIFICAR ANDAMENTO');
    expect(row).toBeDefined();
    expect(row!.count).toBe(2);
    expect(row!.complexity).toBe('baixa');
  });

  it('puts names matching no rule into Outros with neutra', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // t4 "tarefa fora do mapa" matches nothing
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

  it('donut sums by complexity and total invariant holds', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // dayTasks = t1, t2, t4 → 2 baixa (VERIFICAR ANDAMENTO x2), 1 neutra (Outros from t4)
    expect(data.donutDay.baixa).toBe(2);
    expect(data.donutDay.neutra).toBe(1);
    expect(data.donutDay.alta).toBe(0);
    expect(data.donutDay.media).toBe(0);
    const d = data.donutDay;
    expect(d.alta + d.media + d.baixa + d.neutra).toBe(d.total);
  });

  it('team.perDay, perWeek and load with thresholds', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // subtarefasDia=3, team=17 → perDay = round(3/17) = 0 → BAIXA
    expect(data.team.perDay).toBe(0);
    expect(data.team.perWeek).toBe(0);
    expect(data.team.load).toBe('BAIXA');
  });

  it('avgAssigneesPerTask averages over day subtasks', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // day tasks: t1(2), t2(1), t4(0) → avg = 3/3 = 1
    expect(data.team.avgAssigneesPerTask).toBe(1);
  });

  it('formats header.dateLabel in BRT, PT-BR long form', () => {
    const data = aggregate(MUNICIPAL, fixture as RawTask[], TOTALS, NOW);
    // 2026-05-28 04:00 BRT = Thursday 28 de Maio de 2026
    expect(data.header.dateLabel).toBe('Quinta-feira, 28 de Maio de 2026');
  });
});
