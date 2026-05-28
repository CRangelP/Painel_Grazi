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

  const dayRows = groupByStatus(dayTasks, panel);
  const weekRows = groupByStatus(weekTasks, panel);

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
    tasksDay: dayRows,
    tasksWeek: weekRows,
    donutDay: donutFromRows(dayRows),
    donutWeek: donutFromRows(weekRows),
    team: computeTeam(panel, dayTasks, weekTasks),
  };
}
