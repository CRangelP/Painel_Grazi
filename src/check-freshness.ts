import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Max age for docs/*-data.json `generatedAt` before the snapshot is considered stale. */
export const MAX_AGE_MS = 36 * 60 * 60 * 1000;

export const DEFAULT_SNAPSHOT_PATHS = [
  "docs/municipal-data.json",
  "docs/estadual-data.json",
] as const;

export interface SnapshotCheck {
  path: string;
  generatedAt: string;
}

export function parseGeneratedAt(raw: unknown, path: string): string {
  if (typeof raw !== "object" || raw === null || !("generatedAt" in raw)) {
    throw new Error(`[freshness] ${path}: missing generatedAt`);
  }
  const value = (raw as { generatedAt: unknown }).generatedAt;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`[freshness] ${path}: generatedAt must be a non-empty string`);
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`[freshness] ${path}: generatedAt is not a valid date (${value})`);
  }
  return value;
}

export function assertFresh(
  snapshots: SnapshotCheck[],
  now: Date = new Date(),
  maxAgeMs: number = MAX_AGE_MS,
): void {
  for (const { path, generatedAt } of snapshots) {
    const age = now.getTime() - Date.parse(generatedAt);
    if (age > maxAgeMs) {
      const ageHours = (age / (60 * 60 * 1000)).toFixed(1);
      const maxHours = maxAgeMs / (60 * 60 * 1000);
      throw new Error(
        `[freshness] ${path}: generatedAt=${generatedAt} is ${ageHours}h old (max ${maxHours}h)`,
      );
    }
  }
}

export function checkSnapshotFiles(
  cwd: string,
  paths: readonly string[] = DEFAULT_SNAPSHOT_PATHS,
  now: Date = new Date(),
  maxAgeMs: number = MAX_AGE_MS,
): void {
  const snapshots = paths.map((rel) => {
    const full = join(cwd, rel);
    const raw = JSON.parse(readFileSync(full, "utf8")) as unknown;
    return { path: rel, generatedAt: parseGeneratedAt(raw, rel) };
  });
  assertFresh(snapshots, now, maxAgeMs);
  for (const s of snapshots) {
    const ageH = ((now.getTime() - Date.parse(s.generatedAt)) / (60 * 60 * 1000)).toFixed(1);
    console.log(`[freshness] ok ${s.path} generatedAt=${s.generatedAt} (~${ageH}h ago)`);
  }
}

export function main(): void {
  checkSnapshotFiles(process.cwd());
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  try {
    main();
  } catch (e: unknown) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
