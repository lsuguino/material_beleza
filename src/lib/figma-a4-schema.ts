/**
 * Schema TypeScript da fonte oficial do gerador A4 (docs/figma-source-of-truth.json).
 *
 * Duas camadas:
 *   1. Tipos (compile-time)  — validação estática via tsc.
 *   2. Validador runtime      — zero dependências, retorna lista de erros.
 *
 * Uso típico em build:
 *     import fst from '../../docs/figma-source-of-truth.json';
 *     import { assertFigmaSourceOfTruth } from '@/lib/figma-a4-schema';
 *     assertFigmaSourceOfTruth(fst);  // lança em caso de violação
 */

// ---------------------------------------------------------------------------
// Catálogo canônico — fonte da verdade em código
// ---------------------------------------------------------------------------

/**
 * Lista fechada de layoutIdCanonical. Ordem = ordem de `allowedLayouts` no JSON.
 * Grafia IMUTÁVEL — ver docs/figma-source-of-truth.json#constraints.naming.
 */
export const ALLOWED_LAYOUTS = [
  'A4_0_sumario',
  'A4_1_abertura',
  'A4_1_abertura_split',
  'A4_1_abertura_imagem',
  'A4_1_abertura_invertida',
  'A4_1_abertura_full',
  'A4_2_conteudo_misto',
  'A4_2_texto_corrido',
  'A4_2_texto_citacao',
  'A4_2_texto_imagem',
  'A4_2_texto_sidebar',
  'A4_2_duas_colunas',
  'A4_2_duas_colunas_num',
  'A4_2_imagem_texto',
  'A4_2_continuacao',
  'A4_3_sidebar_steps',
  'A4_3_processo_etapas',
  'A4_4_magazine',
  'A4_4_cards_grid',
  'A4_4_destaque_numerico',
  'A4_4_comparativo',
  'A4_4_pros_contras',
  'A4_5_tabela',
  'A4_5_organograma',
  'A4_5_mapa_mental',
  'A4_5_timeline',
  'A4_5_infografico',
  'A4_5_grafico_analise',
  'A4_6_faq',
  'A4_6_lista_icones',
  'A4_6_texto_completo',
  'A4_7_sidebar_conteudo',
  'A4_8_citacao_destaque',
  'A4_8_nota_importante',
  'A4_8_testemunho',
  'A4_8_frase_impacto',
  'A4_8_imagem_overlay',
  'A4_8_imagem_sidebar',
  'A4_9_checklist',
  'A4_9_exercicio',
  'A4_9_resumo_capitulo',
  'A4_9_conceitos_chave',
] as const;

/** Union type derivado da tupla — union exata em tempo de compilação. */
export type LayoutId = (typeof ALLOWED_LAYOUTS)[number];

/** Padrão de grafia: A4_<dígitos>_<snake_case>. Ver constraints.naming.pattern. */
export const LAYOUT_ID_PATTERN = /^A4_\d+_[a-z_]+$/;

/** Seções lógicas do catálogo. */
export type TemplateSection = 'capas' | 'estrutura' | 'miolo' | 'destaques' | 'atividades';

/** figmaNodeId aceita 3 formas especiais além do padrão "<fileNum>:<idx>". */
export type FigmaNodeId =
  | `${number}:${number}`
  | 'no_figma_frame'
  | 'pipeline_only'
  | 'unresolved';

export const FIGMA_NODE_ID_PATTERN = /^(?:\d+:\d+|no_figma_frame|pipeline_only|unresolved)$/;

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

export interface ColorToken {
  value: `#${string}`;
  rgb: readonly [number, number, number];
  usage: string;
}

export interface TypographyScale {
  family: 'Sora' | 'Inter';
  weight: 400 | 600 | 700;
  size: number;
  lineHeight: string;
  letterSpacing: string;
  italic?: boolean;
  usage: string;
}

export interface DesignTokens {
  color: Record<string, ColorToken>;
  typography: {
    fontFamilies: { display: 'Sora'; body: 'Inter' };
    scales: Record<string, TypographyScale>;
  };
  spacing: {
    scale: Record<string, number>;
    semantic: Record<string, number>;
  };
  page: {
    format: 'A4';
    widthPx: 595;
    heightPx: 842;
    dpi: 72;
    margin: { top: number; right: number; bottom: number; left: number };
    usableArea: {
      xStart: number; yStart: number; xEnd: number; yEnd: number;
      width: number; height: number;
    };
    bleed: number;
    overflow: 'hidden';
  };
  grid: Record<string, unknown>;
  border: {
    radius: Record<string, number | string>;
    width: Record<string, number>;
  };
  shadow: Record<string, string>;
  components: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateBlock {
  type: string;
  bg?: string;
  pad?: readonly [number, number, number, number];
  spacing?: number;
  columns?: number;
  rows?: number;
  height?: number;
  width?: number;
  gutter?: number;
  children?: ReadonlyArray<string | { readonly role: string; [k: string]: unknown }>;
}

export interface TemplateStructure {
  header?: TemplateBlock;
  body: TemplateBlock;
  footer?: TemplateBlock;
}

export interface Template {
  id: LayoutId;
  section: string; // pode ter pipe para usos múltiplos (ex.: "capas|estrutura")
  name: string;
  hasSidebar?: boolean;
  hasImage?: boolean;
  hasPageBadge?: boolean;
  isFixed?: boolean;
  pipelineOnly?: boolean;
  fallback?: boolean;
  variants?: Array<{
    usage: string;
    isFixed?: boolean;
    children?: readonly string[];
  }>;
  structure: TemplateStructure;
  typographyByBlock: Record<string, string>;
  contentRules: Record<string, unknown>;
  bestFor: readonly string[];
}

// ---------------------------------------------------------------------------
// Frame mapping
// ---------------------------------------------------------------------------

export interface FrameMapping {
  layoutIdCanonical: LayoutId | 'unmapped';
  figmaFrameNameOriginal: string | null;
  figmaNodeId: FigmaNodeId;
  figmaSection: string | null;
  mappingConfidence: number; // [0..1]
  reviewNeeded?: boolean;
  variant?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Constraints / Inconsistencies / Root
// ---------------------------------------------------------------------------

export interface Inconsistency {
  id: `INC-${string}`;
  severity: 'info' | 'warning' | 'error';
  title: string;
  found: string;
  impact: string;
  resolutionApplied: string;
  recommendation?: string;
}

export interface Constraints {
  global: Record<string, string | readonly string[]>;
  pipelineOnly: Record<string, string>;
  fallback: string;
  naming: {
    pattern: string;
    case: string;
    immutable: true;
    renameForbidden: string;
  };
}

export interface FigmaSourceOfTruth {
  $schema: string;
  version: string;
  generatedAt: string;
  sourceFile: {
    name: string;
    figmaFileKey: string;
    figmaUrl: string;
    rootPageNodeId: string;
    sourceOfTruth: string;
    extractionMethod: string;
    extractionNotes: readonly string[];
  };
  designTokens: DesignTokens;
  allowedLayouts: readonly LayoutId[];
  templates: readonly Template[];
  frameMapping: readonly FrameMapping[];
  constraints: Constraints;
  inconsistencies: readonly Inconsistency[];
  schema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Runtime guards
// ---------------------------------------------------------------------------

export function isLayoutId(s: unknown): s is LayoutId {
  return typeof s === 'string' && (ALLOWED_LAYOUTS as readonly string[]).includes(s);
}

export function isFigmaNodeId(s: unknown): s is FigmaNodeId {
  return typeof s === 'string' && FIGMA_NODE_ID_PATTERN.test(s);
}

export function matchesLayoutIdPattern(s: string): boolean {
  return LAYOUT_ID_PATTERN.test(s);
}

// ---------------------------------------------------------------------------
// Validador estrutural — coleta erros em vez de lançar na primeira
// ---------------------------------------------------------------------------

export type ValidationError = { path: string; message: string };

export interface ValidationResult {
  ok: boolean;
  errors: readonly ValidationError[];
  warnings: readonly ValidationError[];
  stats: {
    allowedLayouts: number;
    templates: number;
    frameMapping: number;
    framesWithNodeId: number;
    framesReviewNeeded: number;
    pipelineOnly: number;
    noFigmaFrame: number;
  };
}

export function validateFigmaSourceOfTruth(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const push = (path: string, message: string, level: 'error' | 'warn' = 'error') => {
    (level === 'error' ? errors : warnings).push({ path, message });
  };

  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      errors: [{ path: '$', message: 'root must be an object' }],
      warnings: [],
      stats: {
        allowedLayouts: 0, templates: 0, frameMapping: 0,
        framesWithNodeId: 0, framesReviewNeeded: 0, pipelineOnly: 0, noFigmaFrame: 0,
      },
    };
  }
  const root = input as Record<string, unknown>;

  // --- allowedLayouts
  const allowed = root.allowedLayouts;
  if (!Array.isArray(allowed)) {
    push('allowedLayouts', 'missing or not an array');
  } else {
    const dup = new Set<string>();
    for (let i = 0; i < allowed.length; i++) {
      const v = allowed[i];
      const p = `allowedLayouts[${i}]`;
      if (typeof v !== 'string') { push(p, 'not a string'); continue; }
      if (!matchesLayoutIdPattern(v)) push(p, `does not match /^A4_\\d+_[a-z_]+$/: "${v}"`);
      if (!isLayoutId(v)) push(p, `not in ALLOWED_LAYOUTS const: "${v}"`);
      if (dup.has(v)) push(p, `duplicate: "${v}"`);
      dup.add(v);
    }
    // allowedLayouts no JSON deve ter EXATAMENTE os mesmos IDs da const
    const asSet = new Set(allowed as string[]);
    for (const want of ALLOWED_LAYOUTS) {
      if (!asSet.has(want)) push('allowedLayouts', `missing canonical id: "${want}"`);
    }
  }

  // --- templates
  const templates = root.templates;
  const knownTemplateIds = new Set<string>();
  if (!Array.isArray(templates)) {
    push('templates', 'missing or not an array');
  } else {
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i] as Record<string, unknown>;
      const p = `templates[${i}]`;
      if (!t || typeof t !== 'object') { push(p, 'not an object'); continue; }
      if (typeof t.id !== 'string') { push(`${p}.id`, 'not a string'); continue; }
      if (!isLayoutId(t.id)) push(`${p}.id`, `not in ALLOWED_LAYOUTS: "${String(t.id)}"`);
      if (knownTemplateIds.has(t.id as string)) push(`${p}.id`, `duplicate template id: "${t.id as string}"`);
      knownTemplateIds.add(t.id as string);
      if (typeof t.name !== 'string') push(`${p}.name`, 'not a string');
      if (typeof t.section !== 'string') push(`${p}.section`, 'not a string');
      const struct = t.structure as Record<string, unknown> | undefined;
      if (!struct || typeof struct !== 'object') push(`${p}.structure`, 'missing or not an object');
      else if (!struct.body) push(`${p}.structure.body`, 'missing required block');
      if (!t.bestFor || !Array.isArray(t.bestFor)) push(`${p}.bestFor`, 'missing or not an array');
    }
    // Cada layoutId canônico deve ter um template
    for (const id of ALLOWED_LAYOUTS) {
      if (!knownTemplateIds.has(id)) push('templates', `missing template for canonical id: "${id}"`);
    }
  }

  // --- frameMapping
  const fm = root.frameMapping;
  const seenFrameIds = new Set<string>();
  let framesWithNodeId = 0;
  let framesReviewNeeded = 0;
  let pipelineOnly = 0;
  let noFigmaFrame = 0;
  if (!Array.isArray(fm)) {
    push('frameMapping', 'missing or not an array');
  } else {
    for (let i = 0; i < fm.length; i++) {
      const m = fm[i] as Record<string, unknown>;
      const p = `frameMapping[${i}]`;
      if (!m || typeof m !== 'object') { push(p, 'not an object'); continue; }
      if (typeof m.layoutIdCanonical !== 'string') { push(`${p}.layoutIdCanonical`, 'not a string'); continue; }
      if (m.layoutIdCanonical !== 'unmapped' && !isLayoutId(m.layoutIdCanonical)) {
        push(`${p}.layoutIdCanonical`, `not in ALLOWED_LAYOUTS: "${m.layoutIdCanonical as string}"`);
      }
      if (typeof m.figmaNodeId !== 'string' || !isFigmaNodeId(m.figmaNodeId)) {
        push(`${p}.figmaNodeId`, `invalid figmaNodeId format: "${String(m.figmaNodeId)}"`);
      } else {
        if (m.figmaNodeId === 'pipeline_only') pipelineOnly++;
        else if (m.figmaNodeId === 'no_figma_frame') noFigmaFrame++;
        else if (m.figmaNodeId !== 'unresolved') {
          framesWithNodeId++;
          if (seenFrameIds.has(m.figmaNodeId)) {
            push(`${p}.figmaNodeId`, `duplicate node id: "${m.figmaNodeId}"`, 'error');
          }
          seenFrameIds.add(m.figmaNodeId);
        } else {
          push(`${p}.figmaNodeId`, 'still "unresolved" — extraction incomplete', 'warn');
        }
      }
      const conf = m.mappingConfidence;
      if (typeof conf !== 'number' || conf < 0 || conf > 1) {
        push(`${p}.mappingConfidence`, `not a number in [0,1]: "${String(conf)}"`);
      }
      if (m.reviewNeeded === true) framesReviewNeeded++;
      // confidence<0.9 em frame real sem reviewNeeded é suspicious
      if (
        typeof conf === 'number' && conf < 0.9 && conf > 0 &&
        m.reviewNeeded !== true &&
        m.figmaNodeId !== 'pipeline_only' &&
        m.figmaNodeId !== 'no_figma_frame'
      ) {
        push(`${p}`, `confidence ${conf} < 0.9 mas reviewNeeded não marcado`, 'warn');
      }
    }

    // cada layoutId canônico deve aparecer em pelo menos uma linha de frameMapping
    const allowedCovered = new Set<string>();
    for (const m of fm) {
      const m2 = m as Record<string, unknown>;
      if (typeof m2.layoutIdCanonical === 'string') allowedCovered.add(m2.layoutIdCanonical);
    }
    for (const id of ALLOWED_LAYOUTS) {
      if (!allowedCovered.has(id)) push('frameMapping', `no entry covers canonical id: "${id}"`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      allowedLayouts: Array.isArray(allowed) ? allowed.length : 0,
      templates: Array.isArray(templates) ? templates.length : 0,
      frameMapping: Array.isArray(fm) ? fm.length : 0,
      framesWithNodeId,
      framesReviewNeeded,
      pipelineOnly,
      noFigmaFrame,
    },
  };
}

/**
 * Build-time assertion: lança um Error detalhado se o JSON violar o schema.
 * Use em Next.js/Node build scripts ou em um teste que rode antes do `next build`.
 */
export function assertFigmaSourceOfTruth(input: unknown): asserts input is FigmaSourceOfTruth {
  const r = validateFigmaSourceOfTruth(input);
  if (!r.ok) {
    const lines = r.errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new Error(
      `figma-source-of-truth.json failed schema validation:\n${lines}\n` +
      `(${r.errors.length} error${r.errors.length === 1 ? '' : 's'}, ${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'})`
    );
  }
}
