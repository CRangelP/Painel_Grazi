export interface RawTask {
  id: string;
  name: string;
  status: { status: string; type: string };
  parent: string | null;
  due_date: string | null;
  assignees: Array<{ id: number }>;
  custom_fields: Array<{ id: string; name: string; value?: unknown }>;
  list: { id: string; name: string };
  folder: { id: string };
}

export type Complexity = 'baixa' | 'media' | 'alta' | 'neutra';

export interface StatusRow {
  status: string;
  count: number;
  complexity: Complexity;
  perPerson: number;
}

export interface DonutBreakdown {
  alta: number;
  media: number;
  baixa: number;
  neutra: number;
  total: number;
}

export interface DashboardData {
  generatedAt: string;
  header: {
    dateLabel: string;
    panelTitle: string;
  };
  kpis: {
    totalProcessos: number;
    admJudicial: number;
    cumprSentenca: number;
    subtarefasDia: number;
    subtarefasSemana: number;
    colaboradores: number;
  };
  tasksDay: StatusRow[];
  tasksWeek: StatusRow[];
  donutDay: DonutBreakdown;
  donutWeek: DonutBreakdown;
  team: {
    perDay: number;
    perWeek: number;
    avgAssigneesPerTask: number;
    load: 'BAIXA' | 'MÉDIA' | 'ALTA';
  };
}

export interface PanelConfig {
  slug: 'municipal' | 'estadual';
  title: string;
  folderId: string;
  teamSize: number;
  statusComplexity: Record<string, Complexity>;
  listPatterns: {
    adm: RegExp;
    cumpr: RegExp;
  };
  outputHtml: string;
  outputJson: string;
}

export interface FolderTotals {
  total: number;
  admJudicial: number;
  cumprSentenca: number;
}
