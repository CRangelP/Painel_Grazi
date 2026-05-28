import { clickupGet } from './clickup-client.js';
import { SUBTASK_CUSTOM_FIELD_NAME, PAGE_SIZE, TIMEZONE } from './config.js';
import type { PanelConfig, RawTask, FolderTotals } from './types.js';

export interface FolderList {
  id: string;
  name: string;
  task_count: number;
}

interface ListsResponse {
  lists: FolderList[];
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

export async function fetchFolderLists(
  folderId: string,
  token: string
): Promise<FolderList[]> {
  const { lists } = await clickupGet<ListsResponse>(`/folder/${folderId}/list`, {}, token);
  if (lists.length === 0) {
    throw new Error(`Folder ${folderId} has no lists`);
  }
  return lists;
}

export async function discoverSubtaskFilter(
  listId: string,
  token: string
): Promise<{ fieldId: string; simIndex: number }> {
  const { fields } = await clickupGet<FieldsResponse>(`/list/${listId}/field`, {}, token);
  const field = fields.find((f) => f.name === SUBTASK_CUSTOM_FIELD_NAME);
  if (!field) {
    throw new Error(
      `Custom field '${SUBTASK_CUSTOM_FIELD_NAME}' not found in list ${listId}`
    );
  }
  const options = field.type_config?.options ?? [];
  const simOption = options.find((o) => o.name === 'SIM');
  if (!simOption) {
    throw new Error(
      `Custom field '${SUBTASK_CUSTOM_FIELD_NAME}' has no 'SIM' option (list ${listId})`
    );
  }
  return { fieldId: field.id, simIndex: simOption.orderindex };
}

/** Portfolio counts from list metadata — no task pagination. */
export function computeFolderTotals(panel: PanelConfig, lists: FolderList[]): FolderTotals {
  let total = 0;
  let adm = 0;
  let cumpr = 0;
  for (const l of lists) {
    total += l.task_count;
    if (panel.listPatterns.adm.test(l.name)) adm += l.task_count;
    else if (panel.listPatterns.cumpr.test(l.name)) cumpr += l.task_count;
  }
  return { total, admJudicial: adm, cumprSentenca: cumpr };
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

export async function fetchClickUpData(
  panel: PanelConfig,
  teamId: string,
  token: string,
  now: Date
): Promise<{ rawTasks: RawTask[]; folderTotals: FolderTotals; window: DueWindow }> {
  const window = computeWindow(now);
  const lists = await fetchFolderLists(panel.folderId, token);
  const filter = await discoverSubtaskFilter(lists[0]!.id, token);
  const folderTotals = computeFolderTotals(panel, lists);
  const rawTasks = await fetchSubtasksForFolder(panel, filter, window, teamId, token);
  return { rawTasks, folderTotals, window };
}
