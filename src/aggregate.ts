import { computeWindow } from './fetch-data.js';
import type {
  DashboardData,
  DonutBreakdown,
  FolderTotals,
  PanelConfig,
  RawTask,
  StatusRow,
} from './types.js';
import { LOAD_THRESHOLDS } from './config.js';

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

function groupByStatus(tasks: RawTask[], panel: PanelConfig): StatusRow[] {
  const canonCounts = new Map<string, number>();
  let outrosCount = 0;
  for (const t of tasks) {
    const key = t.status.status.trim().toUpperCase();
    if (key in panel.statusComplexity) {
      canonCounts.set(key, (canonCounts.get(key) ?? 0) + 1);
    } else {
      outrosCount++;
    }
  }
  const rows: StatusRow[] = [];
  for (const [status, count] of canonCounts) {
    rows.push({
      status,
      count,
      complexity: panel.statusComplexity[status]!,
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

  return {
    generatedAt: now.toISOString(),
    header: { dateLabel: '', panelTitle: panel.title },
    kpis: {
      totalProcessos: folderTotals.total,
      admJudicial: folderTotals.admJudicial,
      cumprSentenca: folderTotals.cumprSentenca,
      subtarefasDia: dayTasks.length,
      subtarefasSemana: weekTasks.length,
      colaboradores: panel.teamSize,
    },
    tasksDay: groupByStatus(dayTasks, panel),
    tasksWeek: groupByStatus(weekTasks, panel),
    donutDay: { alta: 0, media: 0, baixa: 0, neutra: 0, total: dayTasks.length },
    donutWeek: { alta: 0, media: 0, baixa: 0, neutra: 0, total: weekTasks.length },
    team: { perDay: 0, perWeek: 0, avgAssigneesPerTask: 0, load: 'BAIXA' },
  };
}
