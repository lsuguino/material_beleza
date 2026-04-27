import { isVendaTodoSantoDiaCourse, type CourseTheme } from '@/lib/courseThemes';
import { buildClosedLayoutListPromptBlock, sanitizeConteudoLayouts } from '@/lib/allowed-layouts';
import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';
import { VTSD_COLOR, VTSD_MARGENS_A4, VTSD_PAGE } from '@/lib/vtsd-design-system';
import { getSkillsSummaryForPrompt } from '@/lib/skills/load-skills';

/** Tipos de layout que o agente de design pode atribuir a uma página */
export type LayoutTipo =
  // Aberturas
  | 'A4_1_abertura'
  | 'A4_1_abertura_split'
  | 'A4_1_abertura_imagem'
  | 'A4_1_abertura_invertida'
  | 'A4_1_abertura_full'
  // Conteúdo / Texto
  | 'A4_2_conteudo_misto'
  | 'A4_2_continuacao'
  | 'A4_2_texto_corrido'
  | 'A4_2_texto_citacao'
  | 'A4_2_texto_imagem'
  | 'A4_2_texto_sidebar'
  | 'A4_2_duas_colunas'
  | 'A4_2_duas_colunas_num'
  | 'A4_2_imagem_texto'
  // Sidebar / Processos
  | 'A4_3_sidebar_steps'
  | 'A4_3_processo_etapas'
  // Magazine / Cards / Dados
  | 'A4_4_magazine'
  | 'A4_4_cards_grid'
  | 'A4_4_destaque_numerico'
  | 'A4_4_comparativo'
  | 'A4_4_pros_contras'
  | 'A4_4_imagem_destaque'
  // Layouts editoriais com imagem
  | 'A4_2_imagem_overlay'
  | 'A4_2_imagem_flutuante'
  | 'A4_imagem_livre'
  // Diagramas / Visuais
  | 'A4_5_tabela'
  | 'A4_5_organograma'
  | 'A4_5_mapa_mental'
  | 'A4_5_timeline'
  | 'A4_5_infografico'
  | 'A4_5_grafico_analise'
  // Listas / FAQ
  | 'A4_6_faq'
  | 'A4_6_lista_icones'
  | 'A4_6_texto_completo'
  // Sidebar conteúdo
  | 'A4_7_sidebar_conteudo'
  // Destaques
  | 'A4_8_citacao_destaque'
  | 'A4_8_nota_importante'
  | 'A4_8_testemunho'
  | 'A4_8_frase_impacto'
  | 'A4_8_imagem_overlay'
  | 'A4_8_imagem_sidebar'
  // Atividades
  | 'A4_9_checklist'
  | 'A4_9_exercicio'
  | 'A4_9_resumo_capitulo'
  | 'A4_9_conceitos_chave'
  // Sumário
  | 'A4_0_sumario'
  // Legacy
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

${buildClosedLayoutListPromptBlock()}

CAMPOS EM CADA PÁGINA:
- layout_tipo, cor_fundo_principal, cor_fundo_destaque, cor_texto_principal, cor_texto_destaque (hex), icone_sugerido
- proporcao_colunas: '60/40' | '50/50' | '70/30'; usar_barra_lateral; usar_faixa_decorativa

Regras: sugestao_grafico → dados_grafico; sugestao_fluxograma → dois_colunas (ou A4_* no VTSD); etapas/listas → A4_3_sidebar_steps ou lista_icones. Não há imagens neste material (apenas capa pode ter sugestão de imagem).

REGRA CRÍTICA DE VARIAÇÃO VISUAL (obrigatório):
- NUNCA use o mesmo layout_tipo em 2 páginas consecutivas. Cada página DEVE ter um layout diferente da anterior e da próxima.
- Para um material com 8+ páginas de conteúdo, use NO MÍNIMO 5 layout_tipo diferentes.
- Alterne ritmo visual: sidebar → full-width → duas colunas → magazine → sidebar invertida.
- Páginas de texto corrido puro (só parágrafos) devem ser intercaladas com páginas visuais (sidebar, cards, dados).
- A cada 3-4 páginas de conteúdo, insira um layout de destaque (citação, nota importante, frase de impacto).
- Se o conteúdo tem listas/etapas → use A4_3_sidebar_steps ou A4_3_processo_etapas.
- Se tem dados/números → use A4_4_destaque_numerico ou dados_grafico.
- Se tem comparações → use A4_4_comparativo ou A4_4_pros_contras.
- Se tem perguntas → use A4_6_faq.
- No final de cada capítulo → use A4_9_resumo_capitulo ou A4_9_conceitos_chave.

Exemplo de sequência ideal para 8 páginas de conteúdo:
1. A4_1_abertura (abertura do capítulo)
2. A4_2_conteudo_misto (teoria + dica)
3. A4_3_sidebar_steps (passos práticos)
4. A4_4_magazine (visual/dados)
5. A4_8_citacao_destaque (pausa reflexiva)
6. A4_7_sidebar_conteudo (aprofundamento)
7. A4_2_texto_corrido (desenvolvimento)
8. A4_9_resumo_capitulo (fechamento)`;

const VTSD_REFERENCE_DESIGN_SYSTEM = `
${MARGENS_A4_TEXTO}
Regras por layout (Figma Book DS): hero → primeiro bloco top ${VTSD_MARGENS_A4.regras_por_layout.layout_hero.primeiro_bloco.valor_px}px; sidebar → padding sidebar top ${VTSD_MARGENS_A4.regras_por_layout.layout_sidebar.sidebar_padding.top_px}px, coluna ${VTSD_MARGENS_A4.regras_por_layout.layout_sidebar.coluna_padding.top_px}px; full-width empilhado → container inner top/bottom ${VTSD_MARGENS_A4.regras_por_layout.layout_full_width.container_inner.top_px}px; magazine → título top ${VTSD_MARGENS_A4.regras_por_layout.layout_magazine.titulo.top_px}px, callout base bottom ${VTSD_MARGENS_A4.regras_por_layout.layout_magazine.callout_base.bottom_px}px.

TIPOGRAFIA (escala Perfect Fourth 1.333 — alinhada ao Figma Book DS):
- Display: Sora Bold 96px, LH 100% — número decorativo de capítulo
- H1: Sora Bold 32px, LH 110% — título de página/capítulo
- H2: Sora Bold 22px, LH 120% — subtítulo, seção, sidebar title (usar em sidebars ≤250px)
- H3: Sora Bold 16px, LH 130% — card title, conceito, etapa
- Body: Inter Regular 13px, LH 170% — corpo de texto principal
- Label: Inter Semi Bold 11px, LH 140% — overline, tags, letra-espaçamento 1px
- Quote: Inter Italic 13px, LH 170% — citações em bloco
- Badge: Inter Semi Bold 11px — número da página (40×40px, flush bottom)

CURSO VTSD (tema.id = "geral" OU nome contém "venda todo santo dia"):
- Escolha layout_tipo APENAS entre os valores da LISTA FECHADA no início deste prompt (catálogo Figma). Não invente códigos novos.
- Combine o tipo de conteúdo da página com o template adequado (etapas → A4_3_sidebar_steps ou A4_3_processo_etapas; dados → A4_4_destaque_numerico ou A4_5_grafico_analise; comparação → A4_4_comparativo; FAQ → A4_6_faq; etc.).

Tokens de cor: bloco escuro ${VTSD_COLOR.primary_darker}; médio ${VTSD_COLOR.primary_dark}; corpo ${VTSD_COLOR.texto_800}; secundário ${VTSD_COLOR.texto_700}; cyan ${VTSD_COLOR.primary}.
cor_fundo_principal: ${VTSD_COLOR.fundo_page} (folha e colunas de conteúdo sempre brancas); cor_fundo_destaque: ${VTSD_COLOR.primary_darker} ou ${VTSD_COLOR.primary_dark}; em bloco escuro cor_texto_destaque #FFFFFF (tags #B4F8FB).
Citações: Inter itálico — não use Lora/Lexend.
Preserve titulos e sugestao_*; não invente campos extras.

VARIAÇÃO VISUAL OBRIGATÓRIA (curso VTSD):
- NUNCA repita o mesmo layout_tipo em 2 páginas consecutivas. Cada página DEVE ser visualmente diferente da anterior.
- Para 8+ páginas, use no mínimo 6 layouts diferentes dos disponíveis acima.
- Padrão de ritmo recomendado: abertura (sidebar) → conteúdo misto (callouts) → sidebar steps (passos) → magazine (visual) → citação destaque (pausa) → duas colunas (comparação) → texto corrido (aprofundamento) → resumo (fechamento).
- Insira páginas de destaque (A4_8_*) a cada 3-4 páginas de conteúdo para quebrar monotonia.
- Use layouts com sidebar (A4_3_*, A4_7_*) intercalados com layouts full-width (A4_2_*, A4_4_*).
- Analise o CONTEÚDO de cada página para escolher o layout mais adequado: etapas→sidebar_steps, dados→destaque_numerico, comparações→comparativo, FAQ→faq, conclusão→resumo_capitulo.

PREENCHIMENTO MÁXIMO 80% (regra visual):
- Cada página deve usar no máximo 80% da área útil. O conteúdo NUNCA deve avançar até as extremidades ou cortar no rodapé/laterais.
- Priorize layouts que permitam desenvolver o tópico com exemplos/casos já presentes no conteúdo (passos → sidebar_steps; comparação → comparativo; dados → gráfico).
- Páginas de ABERTURA/INTRODUÇÃO de módulo (A4_1_*): devem ser BREVES e visuais — apenas título grande, subtítulo curto e opcionalmente imagem/citação. NÃO atribua textos longos a layouts de abertura.
- Se o bloco_principal de uma página for muito longo para o layout escolhido, a paginação posterior criará continuações automaticamente — prefira layouts que comportem o conteúdo sem comprimir.
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

REGRA DE VARIAÇÃO: NÃO repita o mesmo layout_tipo em páginas consecutivas. Use pelo menos 5 layout_tipo DIFERENTES no material. Se uma página tem sugestao_imagem, use layout A4_4_magazine ou A4_2_texto_imagem.

${conteudoJson}

Retorne o mesmo JSON com os campos de design em cada página. Apenas JSON, sem markdown.`;

  const skills = getSkillsSummaryForPrompt();
  const raw = await openRouterChatByTask('design', {
    system: SYSTEM_PROMPT + (isVTSD ? '\n\n' + VTSD_REFERENCE_DESIGN_SYSTEM : '') + '\n\n' + skills,
    user: userContent,
    max_tokens: 8192,
  });
  if (!raw) {
    throw new Error('Resposta vazia do modelo de design.');
  }

  const parsed = parseJsonFromAI<Record<string, unknown>>(raw);
  return sanitizeConteudoLayouts(parsed, isVTSD);
}
