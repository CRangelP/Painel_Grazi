import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PANELS } from './config.js';
import { aggregate } from './aggregate.js';
import { fetchClickUpData } from './fetch-data.js';
import { renderHub, renderPanel } from './render.js';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    console.error(`[FATAL] env var ${key} is required`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const token = requireEnv('CLICKUP_TOKEN');
  const teamId = requireEnv('CLICKUP_TEAM_ID');
  const now = new Date();
  const outDir = join(process.cwd(), 'docs');
  mkdirSync(outDir, { recursive: true });

  for (const panel of PANELS) {
    console.log(`[${panel.slug}] fetching folder ${panel.folderId}...`);
    const { rawTasks, folderTotals } = await fetchClickUpData(panel, teamId, token, now);
    console.log(
      `[${panel.slug}] ${folderTotals.total} main tasks, ${rawTasks.length} subtasks in window`
    );

    const data = aggregate(panel, rawTasks, folderTotals, now);
    const nonCanon = data.tasksDay.find((r) => r.status === 'Outros');
    if (nonCanon) {
      console.warn(`[${panel.slug}] ${nonCanon.count} non-canon status occurrences in day`);
    }

    writeFileSync(join(outDir, panel.outputHtml), renderPanel(panel, data));
    writeFileSync(join(outDir, panel.outputJson), JSON.stringify(data, null, 2));
    console.log(`[${panel.slug}] wrote ${panel.outputHtml} and ${panel.outputJson}`);
  }

  writeFileSync(join(outDir, 'index.html'), renderHub(PANELS, now));
  console.log('hub index written, all done');
}

main().catch((e: unknown) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
