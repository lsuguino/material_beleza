/**
 * Catálogo de templates de página — Figma "Material Beleza".
 *
 * Cada template corresponde a um frame A4 (595×842px) no Figma,
 * organizado por seção (capas, estrutura, miolo, destaques, atividades).
 *
 * O design-agent usa `bestFor` para selecionar o template ideal
 * com base no conteúdo gerado. O sistema substitui apenas o conteúdo,
 * mantendo a estrutura, tipografia e espaçamentos do design system.
 */

import type { VtsdLayoutA4 } from './vtsd-design-system';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TemplateSection = 'capas' | 'estrutura' | 'miolo' | 'destaques' | 'atividades';

export interface PageTemplate {
  /** Identificador único (kebab-case) */
  id: string;
  /** Nome legível (igual ao layer name no Figma) */
  name: string;
  /** Seção do material */
  section: TemplateSection;
  /** layout_tipo para o design-agent */
  layout: VtsdLayoutA4;
  /** Aceita placeholder de imagem */
  hasImage: boolean;
  /** Possui sidebar teal lateral */
  hasSidebar: boolean;
  /** Possui badge de número de página (flush bottom) */
  hasPageBadge: boolean;
  /** Conteúdo fixo (não substituível pela IA) */
  isFixed: boolean;
  /** Descrição do template e quando usá-lo */
  description: string;
  /** Estrutura de blocos esperada */
  structure: TemplateStructure;
  /** Palavras-chave para o AI selecionar este template */
  bestFor: string[];
}

export interface TemplateStructure {
  header?: TemplateBlock;
  body: TemplateBlock;
  footer?: TemplateBlock;
}

export interface TemplateBlock {
  /** Tipo do bloco */
  type: 'teal-bar' | 'teal-full' | 'white' | 'sidebar-split' | 'image-area' | 'cards-grid' | 'table' | 'two-columns' | 'timeline' | 'funnel' | 'list';
  /** Cor de fundo (hex) */
  background?: string;
  /** Número de colunas (se aplicável) */
  columns?: number;
  /** Blocos filhos esperados */
  children?: string[];
}

// ---------------------------------------------------------------------------
// 📘 CAPAS (fixas — conteúdo não muda)
// ---------------------------------------------------------------------------

const CAPAS: PageTemplate[] = [
  {
    id: 'capa',
    name: 'Capa',
    section: 'capas',
    layout: 'A4_1_abertura',
    hasImage: true,
    hasSidebar: false,
    hasPageBadge: false,
    isFixed: true,
    description: 'Página de capa do material com nome da aula, subtítulo e logo do curso.',
    structure: { body: { type: 'teal-full', children: ['titulo', 'subtitulo', 'logo'] } },
    bestFor: [],
  },
  {
    id: 'boas-vindas',
    name: 'Boas-Vindas',
    section: 'capas',
    layout: 'A4_1_abertura',
    hasImage: false,
    hasSidebar: false,
    hasPageBadge: false,
    isFixed: true,
    description: 'Página de boas-vindas com texto institucional fixo do curso VTSD.',
    structure: { body: { type: 'teal-full', children: ['titulo', 'corpo', 'assinatura', 'logo'] } },
    bestFor: [],
  },
  {
    id: 'contra-capa',
    name: 'Contra-Capa',
    section: 'capas',
    layout: 'A4_1_abertura',
    hasImage: false,
    hasSidebar: false,
    hasPageBadge: false,
    isFixed: true,
    description: 'Última página do material com texto de encerramento fixo e logo.',
    structure: { body: { type: 'teal-full', children: ['corpo', 'logo'] } },
    bestFor: [],
  },
];

// ---------------------------------------------------------------------------
// 📑 ESTRUTURA (sumário + aberturas de capítulo)
// ---------------------------------------------------------------------------

const ESTRUTURA: PageTemplate[] = [
  {
    id: 'sumario',
    name: 'Sumário',
    section: 'estrutura',
    layout: 'A4_0_sumario',
    hasImage: false,
    hasSidebar: false,
    hasPageBadge: true,
    isFixed: false,
    description: 'Índice do material com lista de capítulos e páginas. Header teal com título "Sumário".',
    structure: {
      header: { type: 'teal-bar', background: '#025468' },
      body: { type: 'list', children: ['toc-items'] },
    },
    bestFor: ['índice', 'sumário', 'table of contents'],
  },
  {
    id: 'abertura-capitulo',
    name: 'Início de Capítulo',
    section: 'estrutura',
    layout: 'A4_1_abertura',
    hasImage: true,
    hasSidebar: false,
    hasPageBadge: true,
    isFixed: false,
    description: 'Abertura de capítulo com título H1 em header teal + imagem placeholder + texto introdutório + badge.',
    structure: {
      header: { type: 'teal-bar', background: '#025468', children: ['titulo', 'subtitulo'] },
      body: { type: 'white', children: ['image-placeholder', 'texto-intro'] },
    },
    bestFor: ['abertura', 'início de capítulo', 'novo assunto'],
  },
  {
    id: 'abertura-split',
    name: 'Abertura de Capítulo - Split',
    section: 'estrutura',
    layout: 'A4_1_abertura_split',
    hasImage: false,
    hasSidebar: true,
    hasPageBadge: false,
    isFixed: false,
    description: 'Sidebar teal esquerda com título H2 + conteúdo à direita com passos + número grande do capítulo (Display 96px) no canto inferior esquerdo.',
    structure: {
      body: { type: 'sidebar-split', columns: 2, children: ['sidebar-titulo', 'sidebar-numero', 'content-texto', 'content-passos'] },
    },
    bestFor: ['abertura com passos', 'capítulo com tópicos', 'sidebar'],
  },
  {
    id: 'abertura-imagem',
    name: 'Abertura de Capítulo - Imagem',
    section: 'estrutura',
    layout: 'A4_1_abertura_imagem',
    hasImage: true,
    hasSidebar: true,
    hasPageBadge: false,
    isFixed: false,
    description: 'Sidebar teal esquerda com título + imagem grande à direita + texto introdutório + número do capítulo.',
    structure: {
      body: { type: 'sidebar-split', columns: 2, children: ['sidebar-titulo', 'sidebar-numero', 'image-area', 'texto-intro'] },
    },
    bestFor: ['abertura com imagem', 'capítulo visual'],
  },
  {
    id: 'abertura-invertida',
    name: 'Abertura de Capítulo - Invertida',
    section: 'estrutura',
    layout: 'A4_1_abertura_invertida',
    hasImage: false,
    hasSidebar: true,
    hasPageBadge: false,
    isFixed: false,
    description: 'Conteúdo à esquerda com título H1 + sidebar teal à direita com tópicos do capítulo + número grande.',
    structure: {
      body: { type: 'sidebar-split', columns: 2, children: ['content-titulo', 'content-texto', 'content-numero', 'sidebar-topicos'] },
    },
    bestFor: ['abertura invertida', 'capítulo com lista de tópicos'],
  },
  {
    id: 'abertura-full',
    name: 'Abertura de Capítulo - Full',
    section: 'estrutura',
    layout: 'A4_1_abertura_full',
    hasImage: false,
    hasSidebar: false,
    hasPageBadge: false,
    isFixed: false,
    description: 'Página inteira teal escuro com título grande (48px) centralizado + subtítulo 16px + número do capítulo (96px) inferior esquerdo.',
    structure: {
      body: { type: 'teal-full', children: ['label', 'titulo', 'subtitulo', 'numero-capitulo', 'brand'] },
    },
    bestFor: ['abertura impactante', 'capítulo principal', 'abertura dramática'],
  },
];

// ---------------------------------------------------------------------------
// 📄 MIOLO (conteúdo — substituível pela IA)
// ---------------------------------------------------------------------------

const MIOLO: PageTemplate[] = [
  // --- Texto corrido ---
  {
    id: 'texto-corrido',
    name: 'Miolo - Texto Corrido',
    section: 'miolo',
    layout: 'A4_2_texto_corrido',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Página de texto corrido clássica: título H1 teal + linha de acento + parágrafos com subtítulo H3 intermediário.',
    structure: { body: { type: 'white', children: ['titulo-h1', 'accent-line', 'paragrafos', 'subtitulo-h3', 'paragrafos'] } },
    bestFor: ['texto longo', 'explicação detalhada', 'conteúdo denso', 'desenvolvimento de conceito'],
  },
  {
    id: 'texto-citacao',
    name: 'Miolo - Texto com Citação',
    section: 'miolo',
    layout: 'A4_2_texto_citacao',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Header teal com título + corpo de texto + citação em bloco com barra lateral teal + parágrafos.',
    structure: {
      header: { type: 'teal-bar', background: '#025468' },
      body: { type: 'white', children: ['paragrafos', 'quote-block', 'paragrafos'] },
    },
    bestFor: ['texto com citação', 'conteúdo reflexivo', 'argumentação com referência'],
  },
  {
    id: 'texto-imagem-inline',
    name: 'Miolo - Texto com Imagem Inline',
    section: 'miolo',
    layout: 'A4_2_texto_imagem',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título + parágrafo + placeholder de imagem (495×220px) com legenda + parágrafos após a imagem.',
    structure: { body: { type: 'white', children: ['titulo-h1', 'paragrafo', 'image-placeholder', 'legenda', 'paragrafos'] } },
    bestFor: ['conteúdo com imagem', 'explicação visual', 'demonstração'],
  },
  {
    id: 'texto-sidebar',
    name: 'Miolo - Texto Corrido com Sidebar',
    section: 'miolo',
    layout: 'A4_2_texto_sidebar',
    hasImage: false, hasSidebar: true, hasPageBadge: true, isFixed: false,
    description: 'Barra lateral teal fina (60px) à esquerda com badge + área de texto corrido com label de capítulo, título H1 e parágrafos.',
    structure: { body: { type: 'sidebar-split', columns: 2, children: ['side-accent', 'content-titulo', 'paragrafos'] } },
    bestFor: ['texto com identidade de capítulo', 'leitura contínua com marcador visual'],
  },
  {
    id: 'texto-dica-exercicio',
    name: 'Miolo - Texto com Dica e Exercício',
    section: 'miolo',
    layout: 'A4_2_conteudo_misto',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Barra teal "Dica do Autor" no topo + corpo com parágrafos e citação + imagem lateral + barra teal "Exercício Prático" no rodapé.',
    structure: {
      header: { type: 'teal-bar', background: '#025468', children: ['label-dica', 'texto-dica'] },
      body: { type: 'white', children: ['paragrafos', 'quote-block', 'imagem-texto-row'] },
      footer: { type: 'teal-bar', background: '#025468', children: ['label-exercicio', 'texto-exercicio'] },
    },
    bestFor: ['dica prática', 'exercício', 'conteúdo misto', 'teoria + prática'],
  },
  {
    id: 'texto-grafico',
    name: 'Miolo - Texto com Gráfico',
    section: 'miolo',
    layout: 'A4_4_magazine',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 teal + área de imagem/gráfico + texto + conceito-chave em callout teal.',
    structure: {
      header: { type: 'white', children: ['titulo-h1'] },
      body: { type: 'white', children: ['image-grafico', 'texto', 'callout-conceito'] },
    },
    bestFor: ['gráfico', 'dados visuais', 'chart', 'conceito-chave'],
  },
  {
    id: 'duas-colunas-numeradas',
    name: 'Miolo - Duas Colunas Numeradas',
    section: 'miolo',
    layout: 'A4_2_duas_colunas_num',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 + duas colunas com tópicos numerados lado a lado + conceito-chave.',
    structure: { body: { type: 'two-columns', columns: 2, children: ['titulo', 'col-numerada-1', 'col-numerada-2'] } },
    bestFor: ['tópicos numerados', 'comparação de conceitos', 'lista dual'],
  },
  {
    id: 'duas-colunas',
    name: 'Miolo - Duas Colunas',
    section: 'miolo',
    layout: 'A4_2_duas_colunas',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 teal + duas colunas iguais de texto com subtítulos H3.',
    structure: { body: { type: 'two-columns', columns: 2, children: ['titulo', 'col-1', 'col-2'] } },
    bestFor: ['conteúdo em duas colunas', 'temas paralelos', 'análise lado a lado'],
  },
  {
    id: 'imagem-destaque',
    name: 'Miolo - Imagem em Destaque',
    section: 'miolo',
    layout: 'A4_4_imagem_destaque',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Banner de imagem full-width (280px) no topo + título teal + body. Editorial.',
    structure: { body: { type: 'image-banner', children: ['banner', 'titulo', 'body'] } },
    bestFor: ['cenários reais', 'apresentação visual de conceito', 'pessoas em ação'],
  },
  {
    id: 'imagem-overlay',
    name: 'Miolo - Imagem com Overlay',
    section: 'miolo',
    layout: 'A4_2_imagem_overlay',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Imagem cobre toda a página com overlay teal escuro + título grande e body curto sobreposto. Visual dramático tipo capa de revista.',
    structure: { body: { type: 'image-overlay', children: ['imagem-fundo', 'overlay', 'titulo-overlay', 'body-overlay'] } },
    bestFor: ['cenas memoráveis', 'capítulo importante', 'frase de impacto', 'transição editorial'],
  },
  {
    id: 'imagem-texto',
    name: 'Miolo - Imagem com Texto',
    section: 'miolo',
    layout: 'A4_2_imagem_texto',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Imagem full-width no topo (300px) + barra de legenda teal + título H2 + parágrafos.',
    structure: {
      header: { type: 'image-area' },
      body: { type: 'white', children: ['legenda-bar', 'titulo-h2', 'paragrafos'] },
    },
    bestFor: ['imagem destaque', 'foto com explicação', 'visual primeiro'],
  },
  {
    id: 'sidebar-conteudo',
    name: 'Miolo - Sidebar com Conteúdo',
    section: 'miolo',
    layout: 'A4_7_sidebar_conteudo',
    hasImage: false, hasSidebar: true, hasPageBadge: false, isFixed: false,
    description: 'Sidebar teal (225px) com título + número capítulo + conteúdo à direita com texto, pullquote, passos e callout.',
    structure: { body: { type: 'sidebar-split', columns: 2, children: ['sidebar', 'content-body', 'pullquote', 'steps', 'callout'] } },
    bestFor: ['conteúdo rico', 'múltiplos blocos', 'capítulo com sidebar'],
  },
  {
    id: 'processo-etapas',
    name: 'Miolo - Processo em Etapas',
    section: 'miolo',
    layout: 'A4_3_processo_etapas',
    hasImage: false, hasSidebar: true, hasPageBadge: true, isFixed: false,
    description: 'Sidebar teal com título + lista de etapas numeradas à direita com divisores.',
    structure: { body: { type: 'sidebar-split', columns: 2, children: ['sidebar-titulo', 'steps-numerados'] } },
    bestFor: ['processo', 'passo a passo', 'etapas', 'tutorial', 'how-to'],
  },
  // --- Dados e visualizações ---
  {
    id: 'destaque-numerico',
    name: 'Miolo - Destaque Numérico',
    section: 'miolo',
    layout: 'A4_4_destaque_numerico',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Grid 2×2 de cards com números grandes (36px teal) + descrições + fonte dos dados.',
    structure: { body: { type: 'cards-grid', columns: 2, children: ['titulo', 'stat-cards', 'fonte'] } },
    bestFor: ['estatísticas', 'dados', 'números', 'métricas', 'KPIs'],
  },
  {
    id: 'comparativo',
    name: 'Miolo - Comparativo',
    section: 'miolo',
    layout: 'A4_4_comparativo',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título + duas colunas: "Evite" (fundo cinza) vs "Faça Assim" (fundo teal escuro).',
    structure: { body: { type: 'two-columns', columns: 2, children: ['titulo', 'col-errado', 'col-certo'] } },
    bestFor: ['comparação', 'antes e depois', 'certo vs errado', 'do vs dont'],
  },
  {
    id: 'tabela',
    name: 'Miolo - Tabela',
    section: 'miolo',
    layout: 'A4_5_tabela',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 + tabela com header teal e linhas zebradas. Padding 16px nas rows.',
    structure: { body: { type: 'table', children: ['titulo', 'table-header', 'table-rows'] } },
    bestFor: ['tabela', 'dados tabulares', 'comparação de itens', 'matriz'],
  },
  {
    id: 'organograma',
    name: 'Miolo - Organograma',
    section: 'miolo',
    layout: 'A4_5_organograma',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Hierarquia em 3 níveis: nó raiz teal → 3 ramos → sub-itens com conectores.',
    structure: { body: { type: 'white', children: ['titulo', 'subtitulo', 'org-levels'] } },
    bestFor: ['organograma', 'hierarquia', 'estrutura', 'fluxo de decisão'],
  },
  {
    id: 'mapa-mental',
    name: 'Miolo - Mapa Mental',
    section: 'miolo',
    layout: 'A4_5_mapa_mental',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Nó central (pill teal) + 4 ramos com cards de sub-itens.',
    structure: { body: { type: 'white', children: ['titulo', 'top-branches', 'center-node', 'bottom-branches'] } },
    bestFor: ['mapa mental', 'brainstorm', 'ramificação', 'visão geral de tema'],
  },
  {
    id: 'faq',
    name: 'Miolo - FAQ',
    section: 'miolo',
    layout: 'A4_6_faq',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Header teal "Perguntas Frequentes" + lista de perguntas (H3) com respostas (body) e divisores.',
    structure: {
      header: { type: 'teal-bar', background: '#025468' },
      body: { type: 'list', children: ['faq-items'] },
    },
    bestFor: ['FAQ', 'perguntas e respostas', 'dúvidas frequentes', 'Q&A'],
  },
  {
    id: 'cards-grid',
    name: 'Miolo - Cards Grid',
    section: 'miolo',
    layout: 'A4_4_cards_grid',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 + grid 2×2 de cards teal escuro com número (36px) + título H3 + descrição.',
    structure: { body: { type: 'cards-grid', columns: 2, children: ['titulo', 'cards-2x2'] } },
    bestFor: ['pilares', 'princípios', '4 conceitos', 'grid de conceitos'],
  },
  {
    id: 'timeline',
    name: 'Miolo - Timeline',
    section: 'miolo',
    layout: 'A4_5_timeline',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título + subtítulo + timeline vertical com indicadores circulares, labels e descrições.',
    structure: { body: { type: 'timeline', children: ['titulo', 'subtitulo', 'timeline-items'] } },
    bestFor: ['linha do tempo', 'cronograma', 'evolução', 'semana a semana', 'progressão'],
  },
  {
    id: 'grafico-analise',
    name: 'Miolo - Gráfico com Análise',
    section: 'miolo',
    layout: 'A4_5_grafico_analise',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 + placeholder de gráfico + seção "Principais Insights" com bullet points.',
    structure: { body: { type: 'white', children: ['titulo', 'chart-placeholder', 'insights-label', 'insights-list'] } },
    bestFor: ['análise', 'gráfico com explicação', 'resultados', 'dados com insights'],
  },
  {
    id: 'lista-icones',
    name: 'Miolo - Lista com Ícones',
    section: 'miolo',
    layout: 'A4_6_lista_icones',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 + lista de itens com ícone circular + título H3 + descrição + divisores.',
    structure: { body: { type: 'list', children: ['titulo', 'icon-list-items'] } },
    bestFor: ['ferramentas', 'recursos', 'lista descritiva', 'itens com ícone'],
  },
  {
    id: 'texto-completo',
    name: 'Miolo - Texto Completo',
    section: 'miolo',
    layout: 'A4_6_texto_completo',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Página de leitura pura: H2 + parágrafos + H3 intermediário + mais parágrafos. Sem elementos visuais.',
    structure: { body: { type: 'white', children: ['h2', 'paragrafos', 'h3', 'paragrafos'] } },
    bestFor: ['texto puro', 'leitura contínua', 'conteúdo extenso sem visuais'],
  },
  {
    id: 'infografico-vertical',
    name: 'Miolo - Infográfico Vertical',
    section: 'miolo',
    layout: 'A4_5_infografico',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Header teal com título + funil vertical com barras decrescentes (label + descrição em cada nível).',
    structure: {
      header: { type: 'teal-bar', background: '#025468', children: ['titulo', 'subtitulo'] },
      body: { type: 'funnel', children: ['funnel-bars'] },
    },
    bestFor: ['funil', 'infográfico', 'processo decrescente', 'pipeline', 'jornada'],
  },
  {
    id: 'pros-contras',
    name: 'Miolo - Prós e Contras',
    section: 'miolo',
    layout: 'A4_4_pros_contras',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título + subtítulo + duas colunas com cards: "Vantagens" (verde) vs "Desafios" (vermelho).',
    structure: { body: { type: 'two-columns', columns: 2, children: ['titulo', 'col-pros', 'col-contras'] } },
    bestFor: ['prós e contras', 'vantagens e desvantagens', 'análise SWOT', 'trade-offs'],
  },
];

// ---------------------------------------------------------------------------
// ✨ DESTAQUES
// ---------------------------------------------------------------------------

const DESTAQUES: PageTemplate[] = [
  {
    id: 'citacao-destaque',
    name: 'Citação Destaque',
    section: 'destaques',
    layout: 'A4_8_citacao_destaque',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Página inteira teal escuro com citação grande (36px Sora Bold) centralizada + aspas decorativas + autor.',
    structure: { body: { type: 'teal-full', children: ['aspas', 'citacao', 'divider', 'autor'] } },
    bestFor: ['citação grande', 'frase marcante', 'destaque de autor'],
  },
  {
    id: 'imagem-overlay',
    name: 'Destaque - Imagem Full com Overlay',
    section: 'destaques',
    layout: 'A4_8_imagem_overlay',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Imagem full page (595×842px) com barra overlay teal no rodapé contendo label, título e descrição.',
    structure: { body: { type: 'image-area', children: ['image-full', 'overlay-bar'] } },
    bestFor: ['destaque visual', 'imagem full page', 'impacto visual'],
  },
  {
    id: 'imagem-sidebar',
    name: 'Destaque - Imagem Full com Sidebar',
    section: 'destaques',
    layout: 'A4_8_imagem_sidebar',
    hasImage: true, hasSidebar: true, hasPageBadge: false, isFixed: false,
    description: 'Imagem (370×842px) à esquerda + sidebar teal à direita com label, título, descrição e brand.',
    structure: { body: { type: 'sidebar-split', columns: 2, children: ['image-area', 'sidebar-content'] } },
    bestFor: ['imagem com sidebar', 'destaque com descrição lateral'],
  },
  {
    id: 'nota-importante',
    name: 'Destaque - Nota Importante',
    section: 'destaques',
    layout: 'A4_8_nota_importante',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Card teal centralizado com ícone ⚠, label "ATENÇÃO", título H2 e texto explicativo.',
    structure: { body: { type: 'white', children: ['spacer', 'callout-card', 'spacer'] } },
    bestFor: ['aviso', 'atenção', 'nota importante', 'alerta', 'warning'],
  },
  {
    id: 'testemunho',
    name: 'Destaque - Testemunho',
    section: 'destaques',
    layout: 'A4_8_testemunho',
    hasImage: true, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Avatar circular + citação itálica (22px) centralizada + nome do autor + profissão.',
    structure: { body: { type: 'white', children: ['avatar', 'depoimento', 'nome', 'profissao'] } },
    bestFor: ['depoimento', 'testemunho', 'social proof', 'caso de sucesso'],
  },
  {
    id: 'frase-impacto',
    name: 'Destaque - Frase de Impacto',
    section: 'destaques',
    layout: 'A4_8_frase_impacto',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Barra teal no topo + frase grande (48px Sora Bold teal escuro) + linha de acento + atribuição.',
    structure: { body: { type: 'white', children: ['teal-bar', 'frase', 'accent', 'atribuicao'] } },
    bestFor: ['frase de impacto', 'statement', 'máxima', 'lema'],
  },
  {
    id: 'conceitos-chave',
    name: 'Conceitos-Chave',
    section: 'destaques',
    layout: 'A4_9_conceitos_chave',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Título H1 + cards com barra lateral teal + termo (H3) + definição (body) + divisores.',
    structure: { body: { type: 'list', children: ['titulo', 'definition-cards'] } },
    bestFor: ['glossário', 'conceitos', 'definições', 'termos-chave', 'vocabulário'],
  },
];

// ---------------------------------------------------------------------------
// 📝 ATIVIDADES
// ---------------------------------------------------------------------------

const ATIVIDADES: PageTemplate[] = [
  {
    id: 'checklist',
    name: 'Checklist',
    section: 'atividades',
    layout: 'A4_9_checklist',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Header teal "Checklist" + lista de itens com checkbox quadrado + texto.',
    structure: {
      header: { type: 'teal-bar', background: '#025468', children: ['titulo', 'subtitulo'] },
      body: { type: 'list', children: ['check-items'] },
    },
    bestFor: ['checklist', 'lista de verificação', 'to-do', 'itens a conferir'],
  },
  {
    id: 'exercicio-pratico',
    name: 'Exercício Prático',
    section: 'atividades',
    layout: 'A4_9_exercicio',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Header com ícone circular + label "EXERCÍCIO PRÁTICO" + título H2 + instruções + cards de perguntas com área de escrita.',
    structure: {
      header: { type: 'white', children: ['icon', 'label', 'titulo'] },
      body: { type: 'white', children: ['instrucoes', 'question-cards'] },
    },
    bestFor: ['exercício', 'atividade prática', 'perguntas', 'reflexão guiada'],
  },
  {
    id: 'resumo-capitulo',
    name: 'Resumo do Capítulo',
    section: 'atividades',
    layout: 'A4_9_resumo_capitulo',
    hasImage: false, hasSidebar: false, hasPageBadge: true, isFixed: false,
    description: 'Header teal "RESUMO DO CAPÍTULO" + título "O Que Você Aprendeu" + takeaways numerados com círculos teal.',
    structure: {
      header: { type: 'teal-bar', background: '#025468', children: ['label', 'titulo'] },
      body: { type: 'list', children: ['takeaway-items'] },
    },
    bestFor: ['resumo', 'recap', 'takeaways', 'pontos principais', 'revisão'],
  },
];

// ---------------------------------------------------------------------------
// Exportações
// ---------------------------------------------------------------------------

/** Todos os templates do design system, organizados por seção */
export const PAGE_TEMPLATES: PageTemplate[] = [
  ...CAPAS,
  ...ESTRUTURA,
  ...MIOLO,
  ...DESTAQUES,
  ...ATIVIDADES,
];

/** Templates por seção */
export const TEMPLATES_BY_SECTION: Record<TemplateSection, PageTemplate[]> = {
  capas: CAPAS,
  estrutura: ESTRUTURA,
  miolo: MIOLO,
  destaques: DESTAQUES,
  atividades: ATIVIDADES,
};

/** Templates que aceitam imagem */
export const TEMPLATES_WITH_IMAGE = PAGE_TEMPLATES.filter((t) => t.hasImage);

/** Templates de miolo (substituíveis pela IA) */
export const MIOLO_TEMPLATES = MIOLO;

/** Templates fixos (não substituíveis) */
export const FIXED_TEMPLATES = PAGE_TEMPLATES.filter((t) => t.isFixed);

/** Busca template por ID */
export function getTemplateById(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}

/** Busca templates que melhor se adequam a um tipo de conteúdo */
export function findBestTemplates(contentKeywords: string[], section?: TemplateSection): PageTemplate[] {
  const candidates = section ? TEMPLATES_BY_SECTION[section] : PAGE_TEMPLATES;
  const lowerKeywords = contentKeywords.map((k) => k.toLowerCase());

  return candidates
    .filter((t) => !t.isFixed)
    .map((t) => ({
      template: t,
      score: t.bestFor.reduce((acc, bf) => {
        const bfLower = bf.toLowerCase();
        return acc + lowerKeywords.filter((k) => bfLower.includes(k) || k.includes(bfLower)).length;
      }, 0),
    }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((t) => t.template);
}
