# Painel Grazi

Self-refreshing operational dashboards for the Professors Núcleo (Municipal + Estadual). The HTMLs in `docs/` are regenerated several times a day (04:00 / 11:00 / 16:00 BRT) by a GitHub Action that reads subtask data from ClickUp and served via GitHub Pages.

## Saúde do painel (dois sinais)

Olhar só o site engana: GitHub Pages continua servindo HTML antigo se o refresh falhar. Painel saudável = **os dois**:

1. Workflow **Daily Dashboard** verde em Actions (última execução bem-sucedida).
2. `generatedAt` recente em `docs/municipal-data.json` e `docs/estadual-data.json` (máx. **36h** — constante em `src/check-freshness.ts`).

O workflow **Dashboard Health** roda diariamente só para checar esse `generatedAt` (sem chamar o ClickUp). Em falha, abre (ou comenta) uma Issue com label `alerta`.

### Alertas por e-mail (`cleberrangelp@gmail.com`)

Sem SMTP extra: em falha do Daily Dashboard ou do Health, a Action cria/atualiza uma GitHub Issue `[alerta] …`. Contas que observam o repositório (watch) recebem e-mail de Issue — tipicamente o owner nesse endereço.

Além disso, no GitHub: **Settings → Notifications → Actions** → ative *Send notifications for failed workflows* na conta que deve receber o e-mail de falha de workflow.

## Public URLs

- Hub: `https://<owner>.github.io/Painel_Grazi/`
- Municipal: `https://<owner>.github.io/Painel_Grazi/municipal.html`
- Estadual: `https://<owner>.github.io/Painel_Grazi/estadual.html`

## Local development

```bash
cp .env.example .env   # fill in CLICKUP_TOKEN and CLICKUP_TEAM_ID
npm install
npm test
npm run build          # writes docs/
npm run check-freshness  # fails if docs/*-data.json generatedAt > 36h
```

Open `docs/municipal.html` in a browser to preview.

## Secrets (GitHub Actions)

In repo Settings → Secrets and variables → Actions:

- `CLICKUP_TOKEN` — Personal API Token of the dedicated bot user. Generate at ClickUp → Settings → Apps. The bot must have at least read access to both folders.
- `CLICKUP_TEAM_ID` — the workspace ID. Visible in any ClickUp URL: `https://app.clickup.com/<TEAM_ID>/...`

## GitHub Pages

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` → Folder: `/docs`.

The generated dashboards live at the root of `docs/` (`index.html`, `municipal.html`, `estadual.html`, plus `*-data.json` snapshots). Design specs under `docs/superpowers/` are unrelated and harmless to publish.

## Configuration

`src/config.ts` holds:

- `PANELS` — folder ids, team sizes, list regex patterns, status→complexity maps.
- `LOAD_THRESHOLDS` — perDay ≥ 30 → ALTA, 15..29 → MÉDIA, < 15 → BAIXA.
- `RATE_LIMIT_MS` — minimum gap between ClickUp requests (default 1000ms).

Status names are matched against the per-panel `statusComplexity` map after `.trim().toUpperCase()`. Anything outside the map is aggregated into a single "Outros" row.

## Token rotation

1. Generate new token in ClickUp.
2. Update `CLICKUP_TOKEN` in GitHub Secrets.
3. Revoke the previous token.
4. Trigger the workflow manually (Actions → Daily Dashboard → Run workflow) to confirm.

## First-run probe

Before the first daily build, run a one-off probe to confirm ClickUp pagination is 0-indexed and the `SUBTASK` custom field is reachable:

```bash
CLICKUP_TOKEN=pk_... CLICKUP_TEAM_ID=... node --import tsx scripts/probe-clickup.ts
```

If output reports `1-INDEXED`, update `src/fetch-data.ts` (`fetchSubtasksForFolder` and `fetchFolderTotals`) to start `page` at 1 instead of 0.
