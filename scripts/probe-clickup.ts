#!/usr/bin/env node
/**
 * Probe ClickUp API to verify pagination indexing (0-indexed vs 1-indexed)
 * and confirm SUBTASK custom field is reachable.
 *
 * Usage:
 *   CLICKUP_TOKEN=pk_... CLICKUP_TEAM_ID=... FOLDER_ID=... node --import tsx scripts/probe-clickup.ts
 *
 * Or compile and run:
 *   tsc && node dist-js/scripts/probe-clickup.js
 */

const TOKEN = process.env.CLICKUP_TOKEN;
const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const FOLDER_ID = process.env.FOLDER_ID ?? '90144366189';

if (!TOKEN || !TEAM_ID) {
  console.error('Missing CLICKUP_TOKEN or CLICKUP_TEAM_ID');
  process.exit(1);
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: TOKEN!, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main(): Promise<void> {
  console.log('--- Probe 1: page=0 vs page=1 indexing ---');
  const page0 = (await get(
    `/team/${TEAM_ID}/task?project_ids[]=${FOLDER_ID}&page=0&include_closed=true`
  )) as { tasks: unknown[]; last_page?: boolean };
  const page1 = (await get(
    `/team/${TEAM_ID}/task?project_ids[]=${FOLDER_ID}&page=1&include_closed=true`
  )) as { tasks: unknown[]; last_page?: boolean };
  console.log(`page=0: ${page0.tasks.length} tasks, last_page=${page0.last_page}`);
  console.log(`page=1: ${page1.tasks.length} tasks, last_page=${page1.last_page}`);
  if (page0.tasks.length === 0 && page1.tasks.length > 0) {
    console.error('!! ClickUp is 1-INDEXED. Update fetch-data.ts to start at page=1.');
  } else if (page0.tasks.length > 0) {
    console.log('OK: page=0 is the first page (0-indexed).');
  } else {
    console.log('Both pages empty — folder may be empty or filter mismatch.');
  }

  console.log('\n--- Probe 2: SUBTASK custom field discovery ---');
  const { lists } = (await get(`/folder/${FOLDER_ID}/list`)) as {
    lists: Array<{ id: string; name: string }>;
  };
  console.log(`Folder has ${lists.length} list(s).`);
  if (lists.length === 0) {
    console.error('!! No lists in folder.');
    return;
  }
  const firstList = lists[0]!;
  console.log(`First list: ${firstList.name} (${firstList.id})`);
  const { fields } = (await get(`/list/${firstList.id}/field`)) as {
    fields: Array<{ id: string; name: string; type?: string }>;
  };
  const subtask = fields.find((f) => f.name === 'SUBTASK');
  if (subtask) {
    console.log(`OK: SUBTASK field id = ${subtask.id} (type=${subtask.type ?? 'n/a'})`);
    const opts = ((subtask as any).type_config?.options ?? []) as Array<{ name: string; orderindex: number }>;
    for (const o of opts) {
      console.log(`   ${o.name} orderindex = ${o.orderindex}`);
    }
  } else {
    console.error('!! SUBTASK custom field NOT FOUND in first list.');
    console.error('Available custom fields:');
    for (const f of fields) console.error(`  - ${f.name}`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
