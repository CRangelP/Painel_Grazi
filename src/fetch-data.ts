import { clickupGet } from './clickup-client.js';
import { SUBTASK_CUSTOM_FIELD_NAME, PAGE_SIZE, TIMEZONE } from './config.js';
import type { PanelConfig, RawTask, FolderTotals } from './types.js';

interface ListsResponse {
  lists: Array<{ id: string; name: string }>;
}

interface FieldsResponse {
  fields: Array<{
    id: string;
    name: string;
    type?: string;
    type_config?: {
      options?: Array<{ id: string; name: string; orderindex: number }>;
    };
  }>;
}

interface TasksResponse {
  tasks: RawTask[];
  has_more_tasks?: boolean;
  last_page?: boolean;
}

export async function discoverSubtaskFilter(
  folderId: string,
  token: string
): Promise<{ fieldId: string; simIndex: number }> {
  const { lists } = await clickupGet<ListsResponse>(`/folder/${folderId}/list`, {}, token);
  if (lists.length === 0) {
    throw new Error(`Folder ${folderId} has no lists`);
  }
  const firstList = lists[0]!;
  const { fields } = await clickupGet<FieldsResponse>(
    `/list/${firstList.id}/field`,
    {},
    token
  );
  const field = fields.find((f) => f.name === SUBTASK_CUSTOM_FIELD_NAME);
  if (!field) {
    throw new Error(
      `Custom field '${SUBTASK_CUSTOM_FIELD_NAME}' not found in folder ${folderId}`
    );
  }
  const options = field.type_config?.options ?? [];
  const simOption = options.find((o) => o.name === 'SIM');
  if (!simOption) {
    throw new Error(
      `Custom field '${SUBTASK_CUSTOM_FIELD_NAME}' has no 'SIM' option (folder ${folderId})`
    );
  }
  return { fieldId: field.id, simIndex: simOption.orderindex };
}

export interface DueWindow {
  dayStart: number;
  dayEnd: number;
  weekStart: number;
  weekEnd: number;
}

export function computeWindow(now: Date): DueWindow {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = f.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);

  const tomorrowMidnightUtc = Date.UTC(y, m - 1, d + 1, 3, 0, 0, 0);
  const dayStart = tomorrowMidnightUtc;
  const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
  const weekEnd = dayStart + 6 * 24 * 3600 * 1000 - 1;
  return { dayStart, dayEnd, weekStart: dayStart, weekEnd };
}

export async function fetchSubtasksForFolder(
  panel: PanelConfig,
  filter: { fieldId: string; simIndex: number },
  window: DueWindow,
  teamId: string,
  token: string
): Promise<RawTask[]> {
  const customFieldsParam = JSON.stringify([
    { field_id: filter.fieldId, operator: '=', value: String(filter.simIndex) },
  ]);

  const tasks: RawTask[] = [];
  let page = 0;
  while (true) {
    const res = await clickupGet<TasksResponse>(
      `/team/${teamId}/task`,
      {
        project_ids: [panel.folderId],
        custom_fields: customFieldsParam,
        due_date_gt: String(window.weekStart - 1),
        due_date_lt: String(window.weekEnd + 1),
        include_closed: true,
        subtasks: true,
        include_timl: true,
        page,
      },
      token
    );
    tasks.push(...res.tasks);
    if (res.tasks.length < PAGE_SIZE || res.last_page) break;
    page++;
    if (page > 200) throw new Error('Pagination overflow (>200 pages)');
  }
  return tasks;
}

export async function fetchFolderTotals(
  panel: PanelConfig,
  teamId: string,
  token: string
): Promise<FolderTotals> {
  let total = 0;
  let adm = 0;
  let cumpr = 0;

  let page = 0;
  while (true) {
    const res = await clickupGet<TasksResponse>(
      `/team/${teamId}/task`,
      {
        project_ids: [panel.folderId],
        include_closed: true,
        subtasks: false,
        include_timl: true,
        page,
      },
      token
    );
    for (const t of res.tasks) {
      if (t.parent !== null) continue;
      total++;
      const listName = t.list?.name ?? '';
      if (panel.listPatterns.adm.test(listName)) adm++;
      else if (panel.listPatterns.cumpr.test(listName)) cumpr++;
    }
    if (res.tasks.length < PAGE_SIZE || res.last_page) break;
    page++;
    if (page > 500) throw new Error('Folder totals pagination overflow (>500 pages)');
  }
  return { total, admJudicial: adm, cumprSentenca: cumpr };
}

export async function fetchClickUpData(
  panel: PanelConfig,
  teamId: string,
  token: string,
  now: Date
): Promise<{ rawTasks: RawTask[]; folderTotals: FolderTotals; window: DueWindow }> {
  const window = computeWindow(now);
  const filter = await discoverSubtaskFilter(panel.folderId, token);
  const [rawTasks, folderTotals] = await Promise.all([
    fetchSubtasksForFolder(panel, filter, window, teamId, token),
    fetchFolderTotals(panel, teamId, token),
  ]);
  return { rawTasks, folderTotals, window };
}
