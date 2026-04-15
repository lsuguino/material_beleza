/**
 * Lista fechada de layout_tipo alinhada ao catálogo Figma (page-templates.ts)
 * + exceções do pipeline (continuação, sidebar steps legada no VTSD).
 * O design-agent e o pós-processamento só podem usar estes valores.
 */

import { PAGE_TEMPLATES } from '@/lib/page-templates';

const EXTRA_VTSD_ONLY = ['A4_3_sidebar_steps', 'A4_2_continuacao'] as const;

/** Layouts legados (não-A4) ainda usados em cursos fora do VTSD / fallback. */
export const LEGACY_NON_A4_LAYOUTS = new Set([
  'header_destaque',
  'dois_colunas',
  'citacao_grande',
  'lista_icones',
  'dados_grafico',
  'imagem_lateral',
  'imagem_top',
]);

let cachedVtsdSet: Set<string> | null = null;

/** Conjunto fechado para cursos VTSD e para qualquer layout A4_. */
export function getAllowedVtsdLayoutSet(): Set<string> {
  if (cachedVtsdSet) return cachedVtsdSet;
  const s = new Set<string>();
  for (const t of PAGE_TEMPLATES) {
    s.add(t.layout);
  }
  for (const x of EXTRA_VTSD_ONLY) {
    s.add(x);
  }
  cachedVtsdSet = s;
  return s;
}

export function getAllowedVtsdLayoutListSorted(): string[] {
  return [...getAllowedVtsdLayoutSet()].sort((a, b) => a.localeCompare(b));
}

/** Verifica se layout_tipo está na lista fechada (VTSD / A4 do catálogo). */
export function isAllowedVtsdLayout(layout: string | undefined | null): boolean {
  if (!layout || typeof layout !== 'string') return false;
  return getAllowedVtsdLayoutSet().has(layout.trim());
}

/**
 * Layout permitido para cursos não-VTSD: A4 do catálogo OU legado não-A4.
 */
export function isAllowedNonVtsdLayout(layout: string | undefined | null): boolean {
  if (!layout || typeof layout !== 'string') return false;
  const lt = layout.trim();
  if (LEGACY_NON_A4_LAYOUTS.has(lt)) return true;
  return getAllowedVtsdLayoutSet().has(lt);
}

const FALLBACK_CONTENT = 'A4_2_conteudo_misto';

/**
 * Texto para o system prompt do design-agent: lista fechada, sem inventar novos ids.
 */
export function buildClosedLayoutListPromptBlock(): string {
  const byLayout = new Map<string, { description: string; name: string }>();
  for (const t of PAGE_TEMPLATES) {
    if (!byLayout.has(t.layout)) {
      byLayout.set(t.layout, { description: t.description, name: t.name });
    }
  }
  const lines: string[] = [];
  for (const [layout, meta] of [...byLayout.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  - "${layout}" — ${meta.name}: ${meta.description}`);
  }
  lines.push(
    `  - "A4_3_sidebar_steps" — Sidebar larga + passos (miolo VTSD; mesmo design system).`,
    `  - "A4_2_continuacao" — Só para páginas de continuação automática (campo continuacao); não escolha para páginas normais.`,
    '',
    'REGRAS OBRIGATÓRIAS:',
    '- Use APENAS um dos layout_tipo listados acima (string exata, respeitando maiúsculas/minúsculas e underscores).',
    '- PROIBIDO criar novos valores (ex.: A4_2_custom, "texto longo", variações).',
    '- Se nenhum template encaixar perfeitamente, use "A4_2_conteudo_misto".',
    '- Para cursos não-VTSD, também são permitidos estes layouts legados (somente se necessário): header_destaque, dois_colunas, citacao_grande, lista_icones, dados_grafico, imagem_lateral, imagem_top.'
  );
  return `LISTA FECHADA DE layout_tipo (catálogo Figma + pipeline):\n${lines.join('\n')}`;
}

export type NormalizeLayoutContext = {
  isVtsd: boolean;
  tipo?: string;
  /** Página criada pelo paginador como continuação de texto */
  continuacao?: boolean;
};

/**
 * Normaliza layout_tipo para um valor permitido.
 */
export function normalizeLayoutTipo(
  layout: string | undefined | null,
  ctx: NormalizeLayoutContext
): string {
  const lt = (layout ?? '').trim();
  if (ctx.continuacao) {
    return 'A4_2_continuacao';
  }
  const tipo = (ctx.tipo ?? '').toString();
  // Capa, sumário, etc.: só corrige se vier inválido; vazio preserva
  if (tipo && tipo !== 'conteudo') {
    if (!lt) return lt;
    if (ctx.isVtsd && isAllowedVtsdLayout(lt)) return lt;
    if (!ctx.isVtsd && isAllowedNonVtsdLayout(lt)) return lt;
    return ctx.isVtsd ? 'A4_1_abertura' : 'header_destaque';
  }

  if (ctx.isVtsd) {
    if (isAllowedVtsdLayout(lt)) return lt;
    return FALLBACK_CONTENT;
  }
  if (isAllowedNonVtsdLayout(lt)) return lt;
  if (lt.startsWith('A4_')) return FALLBACK_CONTENT;
  return lt || FALLBACK_CONTENT;
}

/**
 * Percorre conteudo.paginas e normaliza layout_tipo em cada item.
 */
export function sanitizeConteudoLayouts(
  conteudo: Record<string, unknown>,
  isVtsd: boolean
): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas)) return conteudo;
  const fixed = paginas.map((p) => {
    const tipo = (p.tipo as string) || '';
    const continuacao = Boolean(p.continuacao);
    const lt = normalizeLayoutTipo(p.layout_tipo as string, { isVtsd, tipo, continuacao });
    if (lt === (p.layout_tipo as string)) return p;
    return { ...p, layout_tipo: lt };
  });
  return { ...conteudo, paginas: fixed };
}

/** Pool seguro para alternância VTSD (subset do catálogo com bom suporte em PageConteudo). */
export const VTSD_ALTERNATION_POOL: readonly string[] = [
  'A4_1_abertura',
  'A4_2_conteudo_misto',
  'A4_2_texto_corrido',
  'A4_2_texto_citacao',
  'A4_2_texto_sidebar',
  'A4_3_sidebar_steps',
  'A4_4_magazine',
  'A4_7_sidebar_conteudo',
];
