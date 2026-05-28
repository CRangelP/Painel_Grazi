import type { Complexity, PanelConfig } from './types.js';

const STATUS_MUNICIPAL: Record<string, Complexity> = {
  'MANIFESTAR HIPO': 'baixa',
  'REPROTOCOLAR': 'baixa',
  'OBRIGAÇÃO DE FAZER': 'baixa',
  'VERIFICAR ANDAMENTO': 'baixa',
  'PEDIR SEQUESTRO': 'media',
  'IMPUGNAR CONTESTAÇÃO': 'media',
  'INICIAL': 'media',
  'ACOMPANHAR PROCESSOS': 'media',
  'ANALISAR TRANSITADO EM JULGADO': 'media',
  'ANALISAR INTERPOSIÇÃO DE RECURSO SOBRE INDEFERIMENTO DE HIPO': 'media',
  'ANALISAR SENTENÇA PROCEDENTE': 'media',
  'ANALISAR SENTENÇA IMPROCEDENTE/VERIFICAR INTERPOSIÇÃO DE RECURSO': 'media',
  'CONTRARRAZOAR': 'alta',
  'RECURSO': 'alta',
  'CUMPRIMENTO DE SENTENÇA': 'alta',
  'ATUALIZAR CÁLCULOS': 'alta',
};

const STATUS_ESTADUAL: Record<string, Complexity> = {
  'VERIFICAR SENTENÇA': 'baixa',
  'MANIFESTAR HIPOSSUFICIENCIA': 'baixa',
  'MANIFESTAR LITISPENDENCIA': 'baixa',
  'EMENDAR INICIAL': 'baixa',
  'REVISAR PARA PROTOCOLAR': 'baixa',
  'VERIFICAR ANDAMENTO': 'baixa',
  'ANALISE EM GERAL': 'baixa',
  'VERIFICAR DECISÃO MONO': 'media',
  'MANIFESTAR SOBRE PROVAS': 'media',
  'IMPUGNAR CONTESTAÇÃO': 'media',
  'VERIFICAR POSS DE RECURSO': 'alta',
  'CONTRARRAZOAR': 'alta',
  'REALIZAR CÁLCULOS': 'alta',
  'ANALISAR TRANSITO EM JULGADO': 'neutra',
};

export const PANELS: PanelConfig[] = [
  {
    slug: 'municipal',
    title: 'NÚCLEO PROFESSORES — MUNICIPAL',
    folderId: '90144366189',
    teamSize: 17,
    statusComplexity: STATUS_MUNICIPAL,
    listPatterns: {
      adm: /^Adm\/Judicial/i,
      cumpr: /^Cumprimento de Sentença/i,
    },
    outputHtml: 'municipal.html',
    outputJson: 'municipal-data.json',
  },
  {
    slug: 'estadual',
    title: 'NÚCLEO PROFESSORES — ESTADUAL',
    folderId: '90101216715',
    teamSize: 18,
    statusComplexity: STATUS_ESTADUAL,
    // PLACEHOLDER — needs user confirmation per spec Open Question.
    // Until confirmed, ADM matches Adm/Judicial + Execução + RPV; Cumpr matches Cumprimento de Sentença.
    listPatterns: {
      adm: /^(Adm\/Judicial|Execução|RPV)/i,
      cumpr: /^Cumprimento de Sentença/i,
    },
    outputHtml: 'estadual.html',
    outputJson: 'estadual-data.json',
  },
];

export const TIMEZONE = 'America/Sao_Paulo';
export const SUBTASK_CUSTOM_FIELD_NAME = 'SUBTASK';
export const LOAD_THRESHOLDS = { high: 30, mid: 15 } as const;
export const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
export const RATE_LIMIT_MS = 700; // ~85 req/min, under the 100/min cap
export const PAGE_SIZE = 100;
export const FETCH_TIMEOUT_MS = 30_000;
