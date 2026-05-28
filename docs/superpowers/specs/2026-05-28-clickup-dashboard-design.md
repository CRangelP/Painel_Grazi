# Painel Grazi — ClickUp Data-Driven Dashboard

**Date:** 2026-05-28
**Status:** Design approved, pending implementation plan
**Owner:** Rangel

## Problem

Today, `dashboard_MUNICIPAL_atualizado_v2.html` is a single static HTML with all numbers hardcoded. It is regenerated manually. The data lives in ClickUp; we want the dashboard to reflect that data automatically every morning at 04:00 BRT, for two separate panels (Municipal and Estadual).

## Goals

1. Replace hardcoded values with daily-refreshed data pulled from ClickUp.
2. Generate two panels (Municipal, Estadual) from the same codebase.
3. Run unattended (GitHub Actions cron), output to GitHub Pages.
4. Keep the visual output identical to the current HTML (same layout, colors, fonts, base64 logo).
5. Audit-friendly: each day's data is committed as JSON snapshot.

## Non-Goals

- Real-time updates (job is daily, by design).
- Database, user auth, admin UI, REST API.
- Mobile/responsive — viewport stays fixed at 1920×1080 (TV/painel mural).
- Per-collaborator drilldown (only aggregate counts).

## Data Source

- ClickUp REST API v2 (`https://api.clickup.com/api/v2`).
- Auth: Personal Token of a dedicated bot user, scoped via guest access to the two folders. Stored as `CLICKUP_TOKEN` in GitHub Secrets.
- Workspace ID stored as `CLICKUP_TEAM_ID` in GitHub Secrets.

### Folders

| Slug | Folder ID | Purpose |
|---|---|---|
| municipal | `90144366189` | Núcleo Professores — Municipal |
| estadual | `90101216715` | Núcleo Professores — Estadual |

### Subtask Filtering

The ClickUp API does not allow filtering to subtasks only. Approach:

1. Primary filter: a custom field named `SUB-TASK` (boolean, `true` = subtask).
2. Defense in depth: discard tasks where `parent === null` even if the custom field says otherwise.
3. The custom field's `field_id` is discovered at runtime via `GET /list/{list_id}/field` against the first list of each folder.

Endpoint used: `GET /team/{team_id}/task` with query parameters:

```
project_ids[] = <folderId>
custom_fields = [{"field_id":"<id-of-SUB-TASK>","operator":"=","value":"true"}]
due_date_gt   = <window start, epoch ms>
due_date_lt   = <window end, epoch ms>
include_closed = true
subtasks = true
include_timl = true
page = 0,1,2...
```

A separate, unfiltered call counts main tasks per folder (`task.parent === null`) for the portfolio KPI.

### Date Windows (America/Sao_Paulo)

Given `now` = job execution moment:

- **D+1 ("Dia")**: tomorrow 00:00 → tomorrow 23:59:59.
- **D+6 ("Semana")**: tomorrow 00:00 → tomorrow + 5 days 23:59:59 (6 days total, no `now` day).

A subtask is included if its `due_date` falls inside the window.

## Architecture

GitHub Actions cron at 04:00 BRT (07:00 UTC) → Node 20 + TypeScript script → outputs to `dist/` → committed to the repository → served by GitHub Pages from `dist/`.

```
.github/workflows/daily-dashboard.yml   # cron + commit
src/
  clickup-client.ts    # HTTP, auth, retry, throttle, pagination
  fetch-data.ts        # orchestrates raw fetch per panel
  aggregate.ts         # pure: RawTask[] -> DashboardData
  render.ts            # pure: DashboardData -> HTML
  config.ts            # constants: panels, status maps, thresholds
  types.ts             # shared types
  index.ts             # entrypoint
src/__tests__/         # vitest
dist/
  index.html           # hub: 2 cards linking to panels
  municipal.html       # rendered panel
  municipal-data.json  # snapshot
  estadual.html
  estadual-data.json
```

Boundaries:
- `aggregate.ts` and `render.ts` are pure functions, no I/O. Tested with fixtures.
- `clickup-client.ts` owns all HTTP, retry, throttle. Mocked in tests.
- `fetch-data.ts` orchestrates `clickup-client` calls; not unit-tested (trivial composition).
- `index.ts` only does env validation, loop over panels, and disk writes.

## Configuration

```ts
PanelConfig {
  slug:             'municipal' | 'estadual'
  title:            string                       // header.panel-title
  folderId:         string
  teamSize:         number                       // for /pessoa and load calc
  statusComplexity: Record<string, 'baixa'|'media'|'alta'|'neutra'>
  outputHtml:       string                       // 'municipal.html'
  outputJson:       string                       // 'municipal-data.json'
}
```

### Status → Complexity (Municipal, teamSize=17, 16 status)

| Complexity | Status |
|---|---|
| baixa | MANIFESTAR HIPO, REPROTOCOLAR, OBRIGAÇÃO DE FAZER, VERIFICAR ANDAMENTO |
| media | PEDIR SEQUESTRO, IMPUGNAR CONTESTAÇÃO, INICIAL, ACOMPANHAR PROCESSOS, ANALISAR TRANSITADO EM JULGADO, ANALISAR INTERPOSIÇÃO DE RECURSO SOBRE INDEFERIMENTO DE HIPO, ANALISAR SENTENÇA PROCEDENTE, ANALISAR SENTENÇA IMPROCEDENTE/VERIFICAR INTERPOSIÇÃO DE RECURSO |
| alta | CONTRARRAZOAR, RECURSO, CUMPRIMENTO DE SENTENÇA, ATUALIZAR CÁLCULOS |

### Status → Complexity (Estadual, teamSize=18, 14 status)

| Complexity | Status |
|---|---|
| baixa | VERIFICAR SENTENÇA, MANIFESTAR HIPOSSUFICIENCIA, MANIFESTAR LITISPENDENCIA, EMENDAR INICIAL, REVISAR PARA PROTOCOLAR, VERIFICAR ANDAMENTO, ANALISE EM GERAL |
| media | VERIFICAR DECISÃO MONO, MANIFESTAR SOBRE PROVAS, IMPUGNAR CONTESTAÇÃO |
| alta | VERIFICAR POSS DE RECURSO, CONTRARRAZOAR, REALIZAR CÁLCULOS |
| neutra | ANALISAR TRANSITO EM JULGADO |

Status names are normalized via `.trim().toUpperCase()` before lookup. Anything outside the canon table aggregates into a single "Outros" row with `neutra` complexity.

### List Pattern Matching (per panel)

Each panel splits its folder's main tasks into two KPIs (`admJudicial` and `cumprSentenca`) by matching the **list name** against a regex.

```ts
interface PanelListPatterns {
  adm:   RegExp   // matches lists that count toward ADM/Judicial KPI
  cumpr: RegExp   // matches lists that count toward Cumpr. Sentença KPI
}
```

**Municipal** (folder has 2 lists):
- `adm`   = `/^Adm\/Judicial/i`
- `cumpr` = `/^Cumprimento de Sentença/i`

**Estadual** (folder has 5 lists — open question, see below):
- `adm`   = `/^(Adm\/Judicial|Execução|RPV)/i`   // covers EXECUÇÃO, GERAL, Execução GERAL, RPV Complementar
- `cumpr` = `/^Cumprimento de Sentença/i`

A main task whose list matches neither pattern is still counted in `totalProcessos` but in neither sub-KPI. The renderer shows the residual as `totalProcessos - admJudicial - cumprSentenca` if non-zero (sanity check).

> **OPEN — needs user decision for Estadual:** the regex above is a placeholder assumption. The user must confirm which of the 5 Estadual lists belong to ADM and which to Cumpr. Sentença before implementation.

### Other Constants

```
TIMEZONE                 = 'America/Sao_Paulo'
SUBTASK_CUSTOM_FIELD_NAME = 'SUB-TASK'
LOAD_THRESHOLDS          = { high: 30, mid: 15 }   // perDay >= 30 → ALTA, 15..29 → MÉDIA, < 15 → BAIXA
CLICKUP_API_BASE         = 'https://api.clickup.com/api/v2'
RATE_LIMIT_RPS           = 1.5                     // ~90 req/min, under the 100/min cap
PAGE_SIZE                = 100
```

## Output Shape (DashboardData)

```ts
interface DashboardData {
  generatedAt: string                   // ISO
  header: {
    dateLabel: string                   // 'Quarta-feira, 29 de Maio de 2026'
    panelTitle: string
  }
  kpis: {
    totalProcessos:  number             // main tasks across all lists of the folder
    admJudicial:     number             // main tasks in lists matching ADM_LIST_PATTERN
    cumprSentenca:   number             // main tasks in lists matching CUMPR_LIST_PATTERN
    subtarefasDia:   number
    subtarefasSemana:number
    colaboradores:   number             // = teamSize
  }
  tasksDay:  StatusRow[]                // canon statuses + 'Outros'
  tasksWeek: StatusRow[]
  donutDay:  { alta, media, baixa, neutra, total }
  donutWeek: { alta, media, baixa, neutra, total }
  team: {
    perDay:                number       // subtarefasDia / teamSize
    perWeek:               number       // subtarefasSemana / teamSize
    avgAssigneesPerTask:   number       // mean of assignees.length across day subtasks
    load: 'BAIXA' | 'MÉDIA' | 'ALTA'    // derived from perDay and LOAD_THRESHOLDS
  }
}

interface StatusRow {
  status:     string
  count:      number
  complexity: 'baixa' | 'media' | 'alta' | 'neutra'
  perPerson:  number                    // round(count / teamSize)
}
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing env var (`CLICKUP_TOKEN`, `CLICKUP_TEAM_ID`) | Fail fast at startup, `process.exit(1)`. |
| 401 / 403 from ClickUp | Fail immediately, no retry, clear message. |
| 404 (folder missing) | Fail immediately. |
| 429 (rate limit) | Exponential backoff 1s, 2s, 4s. Max 3 attempts. |
| 5xx | 1 retry after 5s. Then fail. |
| Network timeout (>30s) | Treated as 5xx. |
| Custom field `SUB-TASK` not found in folder | Fail with explicit message. |
| Task with `parent === null` slips through | Discarded, log warn with id. |
| Status outside canon | Aggregated into "Outros" / neutra, info log. |
| Subtask in multiple lists (TIML) | Deduplicated by `task.id` in aggregate. |
| Subtask with `due_date === null` | Discarded (query already excludes; double-checked). |
| Empty result for the window | KPIs zero, rows empty, donut zero, HTML still renders. Not an error. |
| Job fails mid-execution | `dist/` is not committed → previous day's HTML keeps being served via GH Pages. GitHub mails the owner. |

Post-fetch invariants (raise if violated):

- All counts non-negative.
- `donut.alta + media + baixa + neutra === donut.total`.

## Scheduling

GitHub Actions workflow `.github/workflows/daily-dashboard.yml`:

- `schedule: '0 7 * * *'` (07:00 UTC = 04:00 BRT).
- `workflow_dispatch:` for manual runs.
- Permissions: `contents: write` (commit `dist/`).
- Steps: checkout → setup-node 20 → `npm ci` → `npm test` → `npm run build` → commit `dist/` if changed → push.
- Bot identity: `dashboard-bot <bot@users.noreply.github.com>`.
- Commit message: `chore(dashboard): daily refresh YYYY-MM-DD`.

## GitHub Pages

Settings → Pages → branch `main`, folder `/dist`.

Public URLs:
- `https://<user>.github.io/Painel_Grazi/` — hub with two cards.
- `https://<user>.github.io/Painel_Grazi/municipal.html`
- `https://<user>.github.io/Painel_Grazi/estadual.html`

## Testing

Runner: **vitest**. Layout: `src/__tests__/` with fixtures under `fixtures/`.

| File | Focus | ~Tests |
|---|---|---|
| `aggregate.test.ts` | All business rules: windowing, grouping, complexity mapping, normalization, dedup, parent check, KPIs, team calc, donut invariant, empty input. | 15 |
| `render.test.ts` | HTML has no leftover placeholders, expected DOM nodes present, base64 logo embedded, status names HTML-escaped. | 5 |
| `clickup-client.test.ts` | `fetch` mocked: 200 happy, 429 retries, 5xx retry, 401 no retry, rate limit gap, array-param serialization. | 6 |

Fixtures: hand-curated `.json` files generated once from a real call and masked. Committed as ground truth.

CI: `npm test` runs both on PRs (separate workflow) and before the daily build. Failed tests abort the build.

## Logging & Audit

- Plain text logs to stdout (not JSON, since this is a single batch run).
- Per panel: fetch start, total tasks fetched, count of non-canon statuses, completion.
- No PII, no task names, no tokens.
- Audit lives in git: `dist/*-data.json` is committed each day, so every snapshot is browsable in git history.

## Out of Scope (explicit YAGNI)

- Slack/email alerts beyond GitHub's default failure mail.
- Database, Redis, queue.
- Multi-tenant config UI.
- Authenticated viewing of the panels (public URLs are fine).
- Historical trend charts (the data is in git for whoever wants to compute it later).

## Open Questions Still Pending

1. **Estadual list split (ADM vs Cumpr. Sentença):** which of the 5 lists go where? Default in the spec is a placeholder regex. Needs explicit user mapping before implementing `fetchClickUpData` for Estadual.

## Open Questions Resolved During Brainstorming

- Subtask filtering → custom field + `parent` sanity check.
- Folder vs list IDs → confirmed folder IDs.
- Single vs multi-panel → multi (Municipal + Estadual), different status maps and teamSize.
- Categoria in row → ClickUp status name.
- Complexity → fixed per-panel map (Municipal: 16 statuses; Estadual: 14 statuses).
- Team size → 17 (Municipal), 18 (Estadual), hardcoded in config.
- Load threshold → `>=30 ALTA, 15..29 MÉDIA, <15 BAIXA`.
- Auth → bot user Personal Token + GitHub Secrets.
- Output → commit to `dist/` + GH Pages.
- Hub → `dist/index.html` with two cards.

## Implementation Plan

To be produced via the `writing-plans` skill in the next step.
