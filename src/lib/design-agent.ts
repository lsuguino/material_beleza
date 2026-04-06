import { isVendaTodoSantoDiaCourse, type CourseTheme } from '@/lib/courseThemes';
import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';
import { VTSD_COLOR, VTSD_LAYOUT_A4, VTSD_MARGENS_A4, VTSD_PAGE } from '@/lib/vtsd-design-system';

/** Tipos de layout que o agente de design pode atribuir a uma página */
export type LayoutTipo =
  | 'A4_1_abertura'
  | 'A4_2_conteudo_misto'
  | 'A4_3_sidebar_steps'
  | 'A4_4_magazine'
  | 'A4_7_sidebar_conteudo'
  | 'header_destaque'
  | 'dois_colunas'
  | 'citacao_grande'
  | 'lista_icones'
  | 'dados_grafico'
  | 'imagem_lateral'
  | 'imagem_top';

/** Proporção de colunas para layout dois_colunas */
export type ProporcaoColunas = '60/40' | '50/50' | '70/30';

/** Campos de design adicionados pelo agente em cada página */
export interface DesignPagina {
  layout_tipo: LayoutTipo;
  cor_fundo_principal: string;
  cor_fundo_destaque: string;
  cor_texto_principal: string;
  cor_texto_destaque: string;
  icone_sugerido: string;
  proporcao_colunas?: ProporcaoColunas;
}

/** Conteúdo estruturado (ex.: material do agente 1) — estrutura livre com páginas/seções */
export type ConteudoEstruturado = Record<string, unknown>;

const MARGENS_A4_TEXTO = `
MARGENS A4 (obrigatório — PDF 595×842px, 72 DPI):
- Área útil vertical: y de ${VTSD_MARGENS_A4.area_util.y_inicio_px} a ${VTSD_MARGENS_A4.area_util.y_fim_px}px (altura ${VTSD_MARGENS_A4.area_util.altura_px}px). Nenhum bloco de CONTEÚDO (texto, callout, imagem didática) começa antes de y=${VTSD_MARGENS_A4.margens.topo_px}px nem termina depois de y=${VTSD_MARGENS_A4.area_util.y_fim_px}px.
- Margens: topo/base/lateral = ${VTSD_MARGENS_A4.margens.topo_px}px. Largura útil típica ${VTSD_MARGENS_A4.area_util.largura_px}px (595 − 2×50). Badge de página fora da área útil: y=${VTSD_MARGENS_A4.badge_pagina.y_px}px, largura ${VTSD_MARGENS_A4.badge_pagina.largura_px}px, altura ${VTSD_MARGENS_A4.badge_pagina.altura_px}px — não cobrir com callouts full-width (reservar margem inferior ou usar bottom:${VTSD_MARGENS_A4.margens.base_px}px no último bloco).
- Evitar: conteúdo em top:0; callout até y=842 cobrindo o badge; sidebar sem padding-top ${VTSD_MARGENS_A4.margens.topo_px}px.
`;

const SYSTEM_PROMPT = `Você é um designer gráfico para materiais didáticos A4 (PDF). Formato: ${VTSD_PAGE.largura_px}×${VTSD_PAGE.altura_px}px (72 DPI), overflow hidden.
${MARGENS_A4_TEXTO}

DESIGN SYSTEM (obrigatório para todos os cursos):
- Tipografia: apenas Sora (títulos, números, badges numéricos) e Inter (corpo, labels, citações em itálico). Nunca outras fontes.
- Grade: baseline 8px; hierarquia clara; ornamentos mínimos e funcionais.
- Contraste: em fundo claro (${VTSD_COLOR.fundo_page}, ${VTSD_COLOR.fundo_subtle}, ${VTSD_COLOR.fundo_box}, ${VTSD_COLOR.fundo_externo}) use #0D0D0D / ${VTSD_COLOR.texto_800} / ${VTSD_COLOR.texto_700}; em blocos teal escuro (${VTSD_COLOR.primary_darker}) use texto #FFFFFF, subtítulos #B4F8FB; badges e médios ${VTSD_COLOR.primary_dark}; acento marca ${VTSD_COLOR.primary}.

Alinhe cor_fundo_* e cor_texto_* ao JSON Tema (primary ≈ ${VTSD_COLOR.primary_dark}, primaryDark ≈ ${VTSD_COLOR.primary_darker}, accent ≈ #B4F8FB).

Retorne APENAS JSON puro, sem markdown. Preserve sugestao_* e content_blocks.

Fora do curso VTSD/geral, layout_tipo legado permitido: header_destaque, dois_colunas, citacao_grande, lista_icones, dados_grafico, imagem_lateral, imagem_top.

CAMPOS EM CADA PÁGINA:
- layout_tipo, cor_fundo_principal, cor_fundo_destaque, cor_texto_principal, cor_texto_destaque (hex), icone_sugerido
- proporcao_colunas: '60/40' | '50/50' | '70/30'; usar_barra_lateral; usar_faixa_decorativa

Regras: sugestao_grafico → dados_grafico; sugestao_fluxograma → dois_colunas (ou A4_* no VTSD); sugestao_imagem → A4_1/A4_4/imagem_* ; etapas/listas → A4_3_sidebar_steps ou lista_icones.`;

const VTSD_REFERENCE_DESIGN_SYSTEM = `
${MARGENS_A4_TEXTO}
Regras por layout (Figma Book DS): hero → primeiro bloco top ${VTSD_MARGENS_A4.regras_por_layout.layout_hero.primeiro_bloco.valor_px}px; sidebar → padding sidebar top ${VTSD_MARGENS_A4.regras_por_layout.layout_sidebar.sidebar_padding.top_px}px, coluna ${VTSD_MARGENS_A4.regras_por_layout.layout_sidebar.coluna_padding.top_px}px; full-width empilhado → container inner top/bottom ${VTSD_MARGENS_A4.regras_por_layout.layout_full_width.container_inner.top_px}px; magazine → título top ${VTSD_MARGENS_A4.regras_por_layout.layout_magazine.titulo.top_px}px, callout base bottom ${VTSD_MARGENS_A4.regras_por_layout.layout_magazine.callout_base.bottom_px}px.

CURSO VTSD (tema.id = "geral" OU nome contém "venda todo santo dia"): use estes layout_tipo para páginas de conteúdo, alternando ritmo:
${VTSD_LAYOUT_A4.map((l) => `- "${l}"`).join('\n')}

- A4_1_abertura: abertura de capítulo — bloco teal escuro, hero visual, corpo abaixo.
- A4_2_conteudo_misto: callout topo, corpo, pullquote, imagem + texto, callout base.
- A4_3_sidebar_steps: sidebar 370px teal + coluna ${VTSD_COLOR.fundo_externo} com passos.
- A4_4_magazine: título teal, foto + texto, callout full-width no rodapé.
- A4_7_sidebar_conteudo: sidebar 225px + coluna ${VTSD_COLOR.fundo_box}.

Tokens: bloco escuro ${VTSD_COLOR.primary_darker}; médio ${VTSD_COLOR.primary_dark}; corpo ${VTSD_COLOR.texto_800}; secundário ${VTSD_COLOR.texto_700}; cyan ${VTSD_COLOR.primary}.
cor_fundo_principal: ${VTSD_COLOR.fundo_page} ou ${VTSD_COLOR.fundo_externo} conforme layout; cor_fundo_destaque: ${VTSD_COLOR.primary_darker} ou ${VTSD_COLOR.primary_dark}; em bloco escuro cor_texto_destaque #FFFFFF (tags #B4F8FB).
Citações: Inter itálico — não use Lora/Lexend.
Preserve titulos e sugestao_*; não invente campos extras.
`;

/**
 * Gera o layout visual (campos de design) para cada página do conteúdo,
 * usando o tema (cores e tipografia) do curso.
 * Retorna o JSON completo com os campos de design adicionados em cada página.
 */
export async function generateDesign(
  conteudo: ConteudoEstruturado,
  tema: CourseTheme
): Promise<Record<string, unknown>> {
  const temaJson = JSON.stringify({
    primary: tema.primary,
    primaryLight: tema.primaryLight,
    primaryDark: tema.primaryDark,
    accent: tema.accent,
    name: tema.name,
    backgroundColor: tema.backgroundColor ?? '#F8F7E8',
  });
  const conteudoJson = JSON.stringify(conteudo);
  const isVTSD = isVendaTodoSantoDiaCourse(tema.id, tema.name);
  const vtsdInstruction = isVTSD ? VTSD_REFERENCE_DESIGN_SYSTEM : '';

  const userContent = `Tema: ${temaJson}

Conteúdo (adicione em cada página: layout_tipo, cor_fundo_principal, cor_fundo_destaque, cor_texto_principal, cor_texto_destaque, icone_sugerido, proporcao_colunas, usar_barra_lateral, usar_faixa_decorativa). Preserve sugestao_*.
${conteudoJson}

${vtsdInstruction}

Retorne o mesmo JSON com os campos de design em cada página. Apenas JSON, sem markdown.`;

  const raw = await openRouterChatByTask('design', {
    system: SYSTEM_PROMPT,
    user: userContent,
    max_tokens: 3072,
  });
  if (!raw) {
    throw new Error('Resposta vazia do modelo de design.');
  }

  return parseJsonFromAI<Record<string, unknown>>(raw);
}
