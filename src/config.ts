import type { ActivityRule, PanelConfig } from './types.js';

// Subtask names are free text classified by keyword against the team's "tarefas do dia".
// Rules are evaluated top-to-bottom: specific keywords first, broad catch-alls last.
// Patterns run on the NAME after it is uppercased and stripped of accents, so write
// them accent-free (e.g. CALCUL matches "CÁLCULO"/"CALCULO").
const ACTIVITIES_MUNICIPAL: ActivityRule[] = [
  { label: 'CUMPRIMENTO DE SENTENÇA', complexity: 'alta', pattern: /CUMPRIMENTO|CUMPRIR SENTENCA/ },
  { label: 'ATUALIZAR CÁLCULOS', complexity: 'alta', pattern: /CALCUL/ },
  { label: 'CONTRARRAZOAR', complexity: 'alta', pattern: /CONTRARRAZ/ },
  { label: 'RECURSO', complexity: 'alta', pattern: /RECURSO|EMBARGOS|AGRAVO/ },
  { label: 'PEDIR SEQUESTRO', complexity: 'media', pattern: /SEQUESTRO/ },
  { label: 'ANALISAR RPV / PRECATÓRIO', complexity: 'media', pattern: /RPV|PRECATORIO|PEQUENO VALOR/ },
  { label: 'IMPUGNAR CONTESTAÇÃO', complexity: 'baixa', pattern: /CONTEST/ },
  { label: 'MANIFESTAR HIPO', complexity: 'baixa', pattern: /HIPO/ },
  { label: 'OBRIGAÇÃO DE FAZER', complexity: 'baixa', pattern: /OBRIGA/ },
  { label: 'ANALISAR SENTENÇA PROC./IMPROC.', complexity: 'media', pattern: /PROCEDENTE|IMPROCED/ },
  { label: 'ANALISAR TRANSITADO EM JULGADO', complexity: 'media', pattern: /TRANSIT/ },
  { label: 'INICIAL', complexity: 'media', pattern: /INICIAL/ },
  { label: 'REPROTOCOLAR', complexity: 'baixa', pattern: /PROTOCOL/ },
  { label: 'VERIFICAR HOMOLOGAÇÃO', complexity: 'baixa', pattern: /HOMOLOGA/ },
  { label: 'PROSSEGUIMENTO', complexity: 'baixa', pattern: /PROSSEGUIMENTO/ },
  { label: 'LITISPENDÊNCIA', complexity: 'baixa', pattern: /LITISPEND/ },
  { label: 'MANIFESTAR SOBRE PROVAS', complexity: 'media', pattern: /PROVAS/ },
  { label: 'PAGAMENTO / ALVARÁ / CONTRACHEQUE', complexity: 'baixa', pattern: /PAGAMENTO|ALVARA|CONTRACHEQUE|GUIA/ },
  { label: 'CONTADORIA', complexity: 'baixa', pattern: /CONTADORIA/ },
  { label: 'DOCUMENTAÇÃO / PENDÊNCIA', complexity: 'baixa', pattern: /PROCURACAO|COMPROVANTE|DOCUMENTA|PENDENCIA COMERCIAL|SENHA|SAC|DADOS BANCARIOS|DESARQUIV/ },
  { label: 'DECURSO DE PRAZO', complexity: 'baixa', pattern: /DECURSO/ },
  { label: 'ANALISAR PROCESSO PARADO (+40 DIAS)', complexity: 'baixa', pattern: /PROCESSO PARADO|40 DIAS/ },
  { label: 'ACOMPANHAR PROCESSOS', complexity: 'media', pattern: /ACOMPANHAR/ },
  { label: 'VERIFICAR ANDAMENTO', complexity: 'baixa', pattern: /ANDAMENTO/ },
];

const ACTIVITIES_ESTADUAL: ActivityRule[] = [
  { label: 'REALIZAR CÁLCULOS', complexity: 'alta', pattern: /CALCUL/ },
  { label: 'CONTRARRAZOAR', complexity: 'alta', pattern: /CONTRARRAZ/ },
  { label: 'CUMPRIR SENTENÇA', complexity: 'alta', pattern: /CUMPRIMENTO|CUMPRIR SENTENCA/ },
  { label: 'VERIFICAR POSS. DE RECURSO', complexity: 'alta', pattern: /RECURSO|EMBARGOS|AGRAVO|REPROTOCOLO/ },
  { label: 'PEDIR SEQUESTRO', complexity: 'media', pattern: /SEQUESTRO/ },
  { label: 'ANALISAR RPV', complexity: 'media', pattern: /RPV|PEQUENO VALOR/ },
  { label: 'IMPUGNAR CONTESTAÇÃO', complexity: 'media', pattern: /CONTEST|IMPUGNA/ },
  { label: 'MANIFESTAR SOBRE PROVAS', complexity: 'media', pattern: /PROVAS/ },
  { label: 'VERIFICAR DECISÃO MONO', complexity: 'alta', pattern: /DECISAO|MONOCRATICA/ },
  { label: 'VERIFICAR SENTENÇA', complexity: 'alta', pattern: /SENTENCA/ },
  { label: 'MANIFESTAR HIPOSSUFICIÊNCIA', complexity: 'baixa', pattern: /HIPO/ },
  { label: 'MANIFESTAR LITISPENDÊNCIA', complexity: 'baixa', pattern: /LITISPEND/ },
  { label: 'EMENDAR INICIAL', complexity: 'baixa', pattern: /INICIAL/ },
  { label: 'REVISAR PARA PROTOCOLAR', complexity: 'baixa', pattern: /PROTOCOL/ },
  { label: 'ANALISAR TRÂNSITO EM JULGADO', complexity: 'baixa', pattern: /TRANSIT/ },
  { label: 'PAGAMENTO / ALVARÁ / CONTRACHEQUE', complexity: 'baixa', pattern: /PAGAMENTO|ALVARA|CONTRACHEQUE/ },
  { label: 'CONTADORIA', complexity: 'baixa', pattern: /CONTADORIA/ },
  { label: 'DOCUMENTAÇÃO / PENDÊNCIA', complexity: 'baixa', pattern: /PROCURACAO|PROCURA|COMPROVANTE|DOCUMENTA|DOCUMENTO|ENDERECO|CESSAO|CUC|DESARQUIV|BLOQUEIO|REGULARIZAR/ },
  { label: 'ANALISAR DESPACHO', complexity: 'baixa', pattern: /DESPACHO/ },
  { label: 'ANALISAR PROCESSO PARADO (+40 DIAS)', complexity: 'baixa', pattern: /PROCESSO PARADO|40 DIAS/ },
  { label: 'VERIFICAR ANDAMENTO', complexity: 'baixa', pattern: /ANDAMENTO/ },
  { label: 'ANÁLISE EM GERAL', complexity: 'baixa', pattern: /ANALISAD|ANALISE DE DIREITO|ANALISAR PROCESSO|HOUVE PAGAMENTO|ANALISAR PAGAMENTO/ },
];

export const PANELS: PanelConfig[] = [
  {
    slug: 'municipal',
    title: 'NÚCLEO PROFESSORES — MUNICIPAL',
    folderId: '90144366189',
    teamSize: 17,
    activities: ACTIVITIES_MUNICIPAL,
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
    activities: ACTIVITIES_ESTADUAL,
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
