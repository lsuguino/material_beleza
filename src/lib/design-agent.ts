import type { CourseTheme } from '@/lib/courseThemes';
import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

/** Tipos de layout que o agente de design pode atribuir a uma página */
export type LayoutTipo =
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

const SYSTEM_PROMPT = `Você é um designer gráfico especializado em materiais didáticos visuais. Siga uma diagramação limpa e moderna: blocos de cor bem definidos, hierarquia clara e contraste de leitura.

DESIGN SYSTEM (obrigatório):
- Estética editorial premium, sem aparência "template genérico de IA".
- Priorize grade consistente, espaçamento amplo, alinhamentos precisos e ritmo visual entre páginas.
- Tipografia com hierarquia forte (título/subtítulo/corpo), evitando excesso de ornamentos.
- Use poucos elementos decorativos, sempre funcionais para leitura e escaneabilidade.
- Mantenha consistência visual entre páginas (mesmo sistema de cor, ícones e blocos), variando apenas o layout.

REGRAS OBRIGATÓRIAS DE DIAGRAMAÇÃO:

1. CORES DO CURSO para elementos de composição:
   - Caixas, blocos, barras, faixas, ícones e símbolos devem usar SEMPRE as cores do tema: primary, primaryDark ou accent.
   - cor_fundo_principal: use a cor de fundo do curso (ex.: bege/creme claro ou o backgroundColor do tema).
   - cor_fundo_destaque: use primary ou accent para blocos/caixas de destaque.

2. FONTE COM COR OPOSTA CONTRASTANTE (obrigatório para leitura):
   - Em fundo ESCURO (primary, primaryDark, blocos coloridos): cor_texto = #FFFFFF ou branco.
   - Em fundo CLARO (creme, bege, branco): cor_texto = #1a1a1a ou #2A2A2A (preto/cinza escuro).
   - Nunca use texto escuro sobre fundo escuro nem texto claro sobre fundo claro.
   - cor_texto_principal: cor do texto no fundo principal da página (sempre contrastante).
   - cor_texto_destaque: cor do texto dentro de blocos/caixas de destaque (sempre contrastante com o fundo do bloco).

3. Estilo visual de referência: páginas com margens claras, imagem no topo ou ao lado, título em maiúsculas ou negrito, texto justificado, linha ou faixa decorativa (chevron/zigzag) na cor do curso na parte inferior quando fizer sentido. Layout de duas colunas com possível barra lateral colorida (30%) e conteúdo principal (70%). Blocos retangulares sólidos para títulos e destaques. Ícones em blocos coloridos com texto claro.

4. Retorne APENAS JSON puro, sem markdown (sem \`\`\`json ou \`\`\`). Sem texto antes ou depois.
5. USE as sugestões do conteúdo: sugestao_imagem, sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone. Mantenha esses campos no JSON de saída.
6. Quando houver sugestao_grafico: layout_tipo "dados_grafico". Quando houver sugestao_fluxograma: "dois_colunas" com fluxograma em destaque. Quando houver sugestao_imagem forte: "imagem_lateral" ou "imagem_top". Quando houver sugestao_tabela: preserve para exibir tabela.
7. Varie os layouts. icone_sugerido: use sugestao_icone do conteúdo ou sugira um descritivo.

CAMPOS DE DESIGN EM CADA PÁGINA:
- layout_tipo: 'header_destaque' | 'dois_colunas' | 'citacao_grande' | 'lista_icones' | 'dados_grafico' | 'imagem_lateral' | 'imagem_top'
- cor_fundo_principal (hex, fundo da página, claro)
- cor_fundo_destaque (hex, primary ou accent para caixas/blocos)
- cor_texto_principal (hex, escuro #1a1a1a ou #2A2A2A em fundo claro)
- cor_texto_destaque (hex, #FFFFFF em blocos escuros)
- icone_sugerido (string)
- proporcao_colunas: '60/40' | '50/50' | '70/30' (para dois_colunas)
- usar_barra_lateral: true/false (para dois_colunas: barra direita colorida com texto rotacionado)
- usar_faixa_decorativa: true/false (linha chevron no rodapé)
PRESERVE: sugestao_imagem, prompt_imagem, sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone.`;

const VTSD_REFERENCE_DESIGN_SYSTEM = `
CURSO "VENDA TODO SANTO DIA" (tema.id = "geral" OU nome contém "venda todo santo dia") — seguir design system de referência (arquivo "Propt pagina.txt"):

TOKENS OBRIGATÓRIOS (usar estes hex):
- teal-dark: #0c8492
- teal-mid: #05a7b5
- teal-accent: #03dfe6
- teal-light: #adf8ff
- text-dark: #2a2a2a
- text-mid: #595959
- page-bg: #dedede

TIPOGRAFIA DE REFERÊNCIA:
- Títulos/headers: estilo Sora (peso alto, tracking negativo leve).
- Corpo: estilo Inter (14px aprox, line-height enxuto).
- Citações: estilo Lora itálica quando houver.

REGRAS DE DIAGRAMAÇÃO (mantendo seus campos JSON):
- Página base clara com cor_fundo_principal próxima de #dedede ou #ffffff.
- Blocos de destaque escuros em #0c8492 com texto branco.
- Acentos, badges e elementos de enumeração em #05a7b5.
- Subtítulos/realces claros em #adf8ff sobre fundo teal.
- Texto corrido em #595959 e títulos em #0c8492.
- Evite layout genérico: reproduza ritmo editorial dos layouts A/B/C/D (hero, blocos full-width, coluna lateral, callout de rodapé), sem depender de imagem fixa.

MAPEAMENTO PARA layout_tipo:
- "header_destaque" para páginas tipo hero/abertura (Layout A).
- "dois_colunas" para páginas mistas e magazine (Layouts B e D).
- "lista_icones" para estrutura de etapas/steps (Layout C).
- "dados_grafico" apenas quando houver sugestao_grafico real.
- "imagem_top" ou "imagem_lateral" apenas quando houver sugestao_imagem/prompt_imagem.

IMPORTANTE:
- Título e conteúdo variam conforme o VTT; preserve isso.
- Não invente campos novos no JSON; só preencher os campos permitidos.
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
  const isVTSD = tema.id === 'geral' || tema.name.toLowerCase().includes('venda todo santo dia');
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
