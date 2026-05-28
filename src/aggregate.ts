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
    tasksDay: [],
    tasksWeek: [],
    donutDay: { alta: 0, media: 0, baixa: 0, neutra: 0, total: dayTasks.length },
    donutWeek: { alta: 0, media: 0, baixa: 0, neutra: 0, total: weekTasks.length },
    team: { perDay: 0, perWeek: 0, avgAssigneesPerTask: 0, load: 'BAIXA' },
  };
}
