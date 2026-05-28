import { clickupGet } from './clickup-client.js';
import { SUBTASK_CUSTOM_FIELD_NAME } from './config.js';
import type { PanelConfig, RawTask, FolderTotals } from './types.js';

interface ListsResponse {
  lists: Array<{ id: string; name: string }>;
}

interface FieldsResponse {
  fields: Array<{ id: string; name: string }>;
}

interface TasksResponse {
  tasks: RawTask[];
  has_more_tasks?: boolean;
  last_page?: boolean;
}

export async function discoverSubtaskFieldId(
  folderId: string,
  token: string
): Promise<string> {
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
  return field.id;
}
