import { describe, expect, it } from 'vitest';
import { renderPanel } from '../render.js';
import { PANELS } from '../config.js';
import type { DashboardData } from '../types.js';

const SAMPLE: DashboardData = {
  generatedAt: '2026-05-28T07:00:00.000Z',
  header: { dateLabel: 'Quinta-feira, 28 de Maio de 2026', panelTitle: 'TEST PANEL' },
  kpis: {
    totalProcessos: 6710,
    admJudicial: 3643,
    cumprSentenca: 3067,
    subtarefasDia: 100,
    subtarefasSemana: 500,
    colaboradores: 17,
  },
  tasksDay: [
    { status: 'CONTRARRAZOAR', count: 10, complexity: 'alta', perPerson: 1 },
    { status: 'Outros', count: 5, complexity: 'neutra', perPerson: 0 },
  ],
  tasksWeek: [],
  donutDay: { alta: 10, media: 0, baixa: 0, neutra: 5, total: 15 },
  donutWeek: { alta: 0, media: 0, baixa: 0, neutra: 0, total: 0 },
  team: { perDay: 6, perWeek: 29, avgAssigneesPerTask: 1.2, load: 'BAIXA' },
};

describe('renderPanel', () => {
  it('produces HTML with no leftover placeholders', () => {
    const html = renderPanel(PANELS[0]!, SAMPLE);
    expect(html).not.toMatch(/\{\{.*?\}\}/);
    expect(html).not.toMatch(/TODO|TBD|FIXME/);
  });

  it('embeds the panel title in the header', () => {
    const html = renderPanel(PANELS[0]!, SAMPLE);
    expect(html).toContain('TEST PANEL');
    expect(html).toContain('Quinta-feira, 28 de Maio de 2026');
  });

  it('embeds KPI values', () => {
    const html = renderPanel(PANELS[0]!, SAMPLE);
    expect(html).toContain('6.710');
    expect(html).toContain('3.643');
  });

  it('embeds the donut canvas IDs and Chart.js script', () => {
    const html = renderPanel(PANELS[0]!, SAMPLE);
    expect(html).toContain('id="donutDay"');
    expect(html).toContain('id="donutWeek"');
    expect(html).toContain('chart.umd.js');
  });

  it('escapes HTML-special chars in status names', () => {
    const data: DashboardData = {
      ...SAMPLE,
      tasksDay: [
        { status: '<script>alert(1)</script>', count: 1, complexity: 'baixa', perPerson: 0 },
      ],
    };
    const html = renderPanel(PANELS[0]!, data);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
