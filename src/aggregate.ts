import { computeWindow } from './fetch-data.js';
import type {
  ActivityRule,
  Complexity,
  DashboardData,
  DonutBreakdown,
  FolderTotals,
  PanelConfig,
  RawTask,
  StatusRow,
} from './types.js';
import { LOAD_THRESHOLDS, TIMEZONE } from './config.js';

function formatHeaderDate(now: Date): string {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const parts = f.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = get('weekday');
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(weekday)}, ${day} de ${cap(month)} de ${year}`;
}

function dedupeById(tasks: RawTask[]): RawTask[] {
  const seen = new Map<string, RawTask>();
  for (const t of tasks) if (!seen.has(t.id)) seen.set(t.id, t);
  return [...seen.values()];
}

function inRange(task: RawTask, start: number, end: number): boolean {
  if (task.due_date === null) return false;
  const ts = Number(task.due_date);
  return ts >= start && ts <= end;
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyActivity(name: string, panel: PanelConfig): ActivityRule | null {
  const normalized = normalizeName(name);
  for (const rule of panel.activities) {
    if (rule.pattern.test(normalized)) return rule;
  }
  return null;
}

function groupByActivity(tasks: RawTask[], panel: PanelConfig): StatusRow[] {
  const counts = new Map<string, { complexity: Complexity; count: number }>();
  let outrosCount = 0;
  for (const t of tasks) {
    const rule = classifyActivity(t.name, panel);
    if (rule) {
      const entry = counts.get(rule.label) ?? { complexity: rule.complexity, count: 0 };
      entry.count++;
      counts.set(rule.label, entry);
    } else {
      outrosCount++;
    }
  }
  const rows: StatusRow[] = [];
  for (const [status, { complexity, count }] of counts) {
    rows.push({
      status,
      count,
      complexity,
      perPerson: Math.round(count / panel.teamSize),
    });
  }
  rows.sort((a, b) => b.count - a.count);
  if (outrosCount > 0) {
    rows.push({
      status: 'Outros',
      count: outrosCount,
      complexity: 'neutra',
      perPerson: Math.round(outrosCount / panel.teamSize),
    });
  }
  return rows;
}

function donutFromRows(rows: StatusRow[]): DonutBreakdown {
  const d = { alta: 0, media: 0, baixa: 0, neutra: 0, total: 0 };
  for (const r of rows) {
    d[r.complexity] += r.count;
    d.total += r.count;
  }
  if (d.alta + d.media + d.baixa + d.neutra !== d.total) {
    throw new Error('aggregate: donut breakdown sum diverges from total');
  }
  return d;
}

function computeLoad(perDay: number): 'BAIXA' | 'MÉDIA' | 'ALTA' {
  if (perDay >= LOAD_THRESHOLDS.high) return 'ALTA';
  if (perDay >= LOAD_THRESHOLDS.mid) return 'MÉDIA';
  return 'BAIXA';
}

function computeTeam(panel: PanelConfig, dayTasks: RawTask[], weekTasks: RawTask[]) {
  const perDay = Math.round(dayTasks.length / panel.teamSize);
  const perWeek = Math.round(weekTasks.length / panel.teamSize);
  const totalAssignees = dayTasks.reduce((sum, t) => sum + t.assignees.length, 0);
  const avgAssigneesPerTask =
    dayTasks.length > 0 ? Math.round((totalAssignees / dayTasks.length) * 10) / 10 : 0;
  return { perDay, perWeek, avgAssigneesPerTask, load: computeLoad(perDay) };
}

export function aggregate(
  panel: PanelConfig,
  rawTasks: RawTask[],
  folderTotals: FolderTotals,
  now: Date
): DashboardData {
  const win = computeWindow(now);
  const valid = dedupeById(rawTasks).filter((t) => t.parent !== null);
  const dayTasks = valid.filter((t) => inRange(t, win.dayStart, win.dayEnd));
  const weekTasks = valid.filter((t) => inRange(t, win.weekStart, win.weekEnd));

  const dayRows = groupByActivity(dayTasks, panel);
  const weekRows = groupByActivity(weekTasks, panel);

  return {
    generatedAt: now.toISOString(),
    header: { dateLabel: formatHeaderDate(now), panelTitle: panel.title },
    kpis: {
      totalProcessos: folderTotals.total,
      admJudicial: folderTotals.admJudicial,
      cumprSentenca: folderTotals.cumprSentenca,
      subtarefasDia: dayTasks.length,
      subtarefasSemana: weekTasks.length,
      colaboradores: panel.teamSize,
    },
    tasksDay: dayRows,
    tasksWeek: weekRows,
    donutDay: donutFromRows(dayRows),
    donutWeek: donutFromRows(weekRows),
    team: computeTeam(panel, dayTasks, weekTasks),
  };
}
