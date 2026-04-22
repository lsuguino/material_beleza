/**
 * Tokens de design extraídos programaticamente do Figma (Material Beleza).
 * Arquivo: zUCLefkhX0Fm2xjiXDUmHo
 *
 * Cada template tem sua estrutura exata de blocos, paddings e espaçamentos.
 * O sistema usa esses tokens para renderizar páginas sem depender de IA para layout.
 */

// ============================================================
// CORES (extraídas do Figma)
// ============================================================
export const FIGMA_COLORS = {
  tealDark: '#025468',       // rgb(2,84,104) — headers, sidebars, callouts
  tealAccent: '#0599a8',     // rgb(5,153,168) — badges, destaques
  cyanLight: '#5decf2',      // rgb(93,236,242) — subtítulos sobre teal, dividers
  white: '#ffffff',          // fundos de página e texto sobre teal
  darkText: '#1a1a1a',       // títulos sobre fundo branco
  grayText: '#666666',       // corpo de texto
  lightBg: '#f5f5f5',        // cards, áreas de destaque
  subtleBg: '#f6f6f6',       // citação background
} as const;

// ============================================================
// TIPOGRAFIA (escala Perfect Fourth — extraída do Figma Book DS)
// ============================================================
export const FIGMA_TYPO = {
  display: { family: 'Sora', weight: 700, size: 96, lineHeight: '100%', use: 'Número de capítulo' },
  h1:      { family: 'Sora', weight: 700, size: 32, lineHeight: '110%', use: 'Título de página' },
  h2:      { family: 'Sora', weight: 700, size: 22, lineHeight: '120%', use: 'Subtítulo, sidebar' },
  h3:      { family: 'Sora', weight: 700, size: 16, lineHeight: '130%', use: 'Card title, etapa' },
  body:    { family: 'Inter', weight: 400, size: 13, lineHeight: '170%', use: 'Texto corpo' },
  label:   { family: 'Inter', weight: 600, size: 11, lineHeight: '140%', use: 'Overline, tags' },
  quote:   { family: 'Inter', weight: 400, size: 13, lineHeight: '170%', style: 'italic', use: 'Citação' },
  badge:   { family: 'Inter', weight: 600, size: 11, lineHeight: 'auto', use: 'Número página' },
  impact:  { family: 'Sora', weight: 700, size: 48, lineHeight: '110%', use: 'Frase de impacto' },
  cite:    { family: 'Sora', weight: 700, size: 36, lineHeight: '110%', use: 'Citação destaque' },
} as const;

// ============================================================
// ESPAÇAMENTOS (extraídos do Figma — valores em px)
// ============================================================
export const FIGMA_SPACING = {
  page: { width: 595, height: 842 },
  margin: { top: 50, right: 50, bottom: 50, left: 50 },
  usableArea: { width: 495, height: 742, yStart: 50, yEnd: 792 },
  blockGap: 20,        // espaço entre blocos de conteúdo
  titleToBody: 12,     // espaço título → corpo
  listItemGap: 16,     // espaço entre itens de lista
  sidebarWidth: 225,   // sidebar teal (layouts split)
  contentWidth: 370,   // coluna de conteúdo (ao lado da sidebar)
  sideAccentWidth: 60, // barra lateral fina (texto corrido com sidebar)
  badge: { width: 40, height: 36, borderRadius: '8px 8px 0 0', y: 806 },
} as const;

// ============================================================
// TEMPLATES — Estrutura exata de cada layout (extraído do Figma)
// ============================================================
export interface FigmaTemplateSpec {
  name: string;
  layout: 'VERTICAL' | 'HORIZONTAL';
  outerPad: [number, number, number, number]; // [top, right, bottom, left]
  outerSpacing: number;
  blocks: FigmaBlockSpec[];
  hasPageBadge: boolean;
}

export interface FigmaBlockSpec {
  name: string;
  type: 'header' | 'body' | 'footer' | 'sidebar' | 'content' | 'spacer' | 'badge' | 'bar' | 'grid' | 'image';
  layout: 'VERTICAL' | 'HORIZONTAL' | 'NONE';
  width: number | 'fill';
  height: number | 'fill' | 'hug';
  pad: [number, number, number, number];
  spacing: number;
  bg?: string;
  childCount?: number;
}

export const FIGMA_TEMPLATES: Record<string, FigmaTemplateSpec> = {
  // ----- TEXTO CORRIDO (sem header teal) -----
  'texto-corrido': {
    name: 'Miolo - Texto Corrido',
    layout: 'VERTICAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: true,
    blocks: [
      { name: 'Body', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'fill',
        pad: [50, 50, 20, 50], spacing: 20 },
    ],
  },

  // ----- TEXTO COM CITAÇÃO (header teal + body) -----
  'texto-citacao': {
    name: 'Miolo - Texto com Citação',
    layout: 'VERTICAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: true,
    blocks: [
      { name: 'Header', type: 'header', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [40, 50, 30, 50], spacing: 8, bg: '#025468' },
      { name: 'Body', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'fill',
        pad: [30, 50, 20, 50], spacing: 20 },
    ],
  },

  // ----- TEXTO COM DICA E EXERCÍCIO (dica teal + body + exercício teal) -----
  'texto-dica-exercicio': {
    name: 'Miolo - Texto com Dica e Exercício',
    layout: 'VERTICAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 20,
    hasPageBadge: true,
    blocks: [
      { name: 'Dica-Bar', type: 'header', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [20, 50, 20, 50], spacing: 8, bg: '#025468' },
      { name: 'Body', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'fill',
        pad: [30, 50, 20, 50], spacing: 20 },
      { name: 'Exercicio-Bar', type: 'footer', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [20, 50, 20, 50], spacing: 8, bg: '#025468' },
    ],
  },

  // ----- TEXTO CORRIDO COM SIDEBAR (barra teal 60px + conteúdo) -----
  'texto-sidebar': {
    name: 'Miolo - Texto Corrido com Sidebar',
    layout: 'HORIZONTAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: false,
    blocks: [
      { name: 'Side-Accent', type: 'sidebar', layout: 'VERTICAL', width: 60, height: 'fill',
        pad: [50, 0, 30, 0], spacing: 0, bg: '#025468' },
      { name: 'Content', type: 'content', layout: 'VERTICAL', width: 535, height: 'fill',
        pad: [50, 50, 50, 30], spacing: 20, bg: '#ffffff' },
    ],
  },

  // ----- DESTAQUE NUMÉRICO (header + grid 2x2 + footer) -----
  'destaque-numerico': {
    name: 'Miolo - Destaque Numérico',
    layout: 'VERTICAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: true,
    blocks: [
      { name: 'Header', type: 'header', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [40, 50, 30, 50], spacing: 8 },
      { name: 'Stats-Grid', type: 'grid', layout: 'VERTICAL', width: 'fill', height: 'fill',
        pad: [20, 50, 20, 50], spacing: 0 },
      { name: 'Footer-Text', type: 'footer', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [20, 50, 20, 50], spacing: 0 },
    ],
  },

  // ----- ABERTURA SPLIT (sidebar teal esquerda 370px + conteúdo direita) -----
  'abertura-split': {
    name: 'Abertura de Capítulo - Split',
    layout: 'HORIZONTAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: false,
    blocks: [
      { name: 'Sidebar', type: 'sidebar', layout: 'VERTICAL', width: 370, height: 'fill',
        pad: [50, 50, 20, 50], spacing: 10, bg: '#025468' },
      { name: 'Content', type: 'content', layout: 'VERTICAL', width: 225, height: 'fill',
        pad: [50, 0, 50, 0], spacing: 0 },
    ],
  },

  // ----- ABERTURA IMAGEM (sidebar teal 225px + imagem/conteúdo 370px) -----
  'abertura-imagem': {
    name: 'Abertura de Capítulo - Imagem',
    layout: 'HORIZONTAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: false,
    blocks: [
      { name: 'Sidebar', type: 'sidebar', layout: 'VERTICAL', width: 225, height: 'fill',
        pad: [50, 20, 30, 50], spacing: 10, bg: '#025468' },
      { name: 'Content', type: 'content', layout: 'VERTICAL', width: 370, height: 'fill',
        pad: [0, 0, 0, 0], spacing: 0, bg: '#ffffff' },
    ],
  },

  // ----- ABERTURA FULL (página inteira teal) -----
  'abertura-full': {
    name: 'Abertura de Capítulo - Full',
    layout: 'VERTICAL',
    outerPad: [50, 50, 30, 50],
    outerSpacing: 0,
    hasPageBadge: false,
    blocks: [
      { name: 'Top', type: 'header', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [0, 0, 0, 0], spacing: 8 },
      { name: 'Center', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [0, 0, 0, 0], spacing: 20 },
      { name: 'Bottom', type: 'footer', layout: 'HORIZONTAL', width: 'fill', height: 'hug',
        pad: [0, 0, 0, 0], spacing: 20 },
    ],
  },

  // ----- CITAÇÃO DESTAQUE (teal full, citação 36px) -----
  'citacao-destaque': {
    name: 'Citação Destaque',
    layout: 'VERTICAL',
    outerPad: [50, 50, 50, 50],
    outerSpacing: 30,
    hasPageBadge: true,
    blocks: [
      { name: 'Quote', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'fill',
        pad: [0, 0, 0, 0], spacing: 30 },
    ],
  },

  // ----- FRASE DE IMPACTO (fundo branco, frase 48px) -----
  'frase-impacto': {
    name: 'Destaque - Frase de Impacto',
    layout: 'VERTICAL',
    outerPad: [0, 50, 50, 50],
    outerSpacing: 20,
    hasPageBadge: true,
    blocks: [
      { name: 'Teal-Bar', type: 'bar', layout: 'NONE', width: 'fill', height: 6,
        pad: [0, 0, 0, 0], spacing: 0, bg: '#0599a8' },
      { name: 'Spacer', type: 'spacer', layout: 'NONE', width: 10, height: 'fill',
        pad: [0, 0, 0, 0], spacing: 0 },
      { name: 'Body', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'hug',
        pad: [0, 0, 0, 0], spacing: 20 },
      { name: 'Spacer', type: 'spacer', layout: 'NONE', width: 10, height: 'fill',
        pad: [0, 0, 0, 0], spacing: 0 },
    ],
  },

  // ----- CONTINUAÇÃO (barra teal topo + rodapé) -----
  'continuacao': {
    name: 'Continuação',
    layout: 'VERTICAL',
    outerPad: [0, 0, 0, 0],
    outerSpacing: 0,
    hasPageBadge: true,
    blocks: [
      { name: 'Top-Bar', type: 'bar', layout: 'NONE', width: 'fill', height: 6,
        pad: [0, 0, 0, 0], spacing: 0, bg: '#0599a8' },
      { name: 'Body', type: 'body', layout: 'VERTICAL', width: 'fill', height: 'fill',
        pad: [30, 50, 50, 50], spacing: 20 },
      { name: 'Bottom-Bar', type: 'bar', layout: 'NONE', width: 'fill', height: 6,
        pad: [0, 0, 0, 0], spacing: 0, bg: '#0599a8' },
    ],
  },
};

/**
 * CSS-in-JS styles gerados programaticamente dos tokens do Figma.
 * Usar nos componentes React para garantir fidelidade ao design.
 */
export const FIGMA_CSS = {
  page: {
    width: '595px',
    height: '842px',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    backgroundColor: FIGMA_COLORS.white,
    fontFamily: "'Inter', sans-serif",
  },
  headerTeal: {
    backgroundColor: FIGMA_COLORS.tealDark,
    padding: '40px 50px 30px 50px',
    boxSizing: 'border-box' as const,
  },
  bodyBlock: {
    // Reserva espaço inferior para o badge de página (40x36) sem sobrepor texto.
    padding: '30px 50px 56px 50px',
    boxSizing: 'border-box' as const,
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'hidden' as const,
  },
  footerTeal: {
    backgroundColor: FIGMA_COLORS.tealDark,
    padding: '20px 50px',
    boxSizing: 'border-box' as const,
  },
  sidebar225: {
    width: '225px',
    height: '842px',
    backgroundColor: FIGMA_COLORS.tealDark,
    padding: '50px 20px 30px 50px',
    boxSizing: 'border-box' as const,
    flexShrink: 0,
  },
  sidebar60: {
    width: '60px',
    height: '842px',
    backgroundColor: FIGMA_COLORS.tealDark,
    flexShrink: 0,
  },
  content370: {
    width: '370px',
    height: '842px',
    backgroundColor: FIGMA_COLORS.white,
    padding: '50px 50px 56px 20px',
    boxSizing: 'border-box' as const,
  },
  badge: {
    position: 'absolute' as const,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '40px',
    height: '36px',
    backgroundColor: FIGMA_COLORS.tealAccent,
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: FIGMA_COLORS.white,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '11px',
  },
  tealBarThin: {
    width: '100%',
    height: '6px',
    backgroundColor: FIGMA_COLORS.tealAccent,
    flexShrink: 0,
  },
  // Tipografia
  h1White: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '32px',
    lineHeight: '110%',
    color: FIGMA_COLORS.white,
    margin: 0,
  },
  h1Teal: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '32px',
    lineHeight: '110%',
    color: FIGMA_COLORS.tealAccent,
    margin: 0,
  },
  h2White: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '22px',
    lineHeight: '120%',
    color: FIGMA_COLORS.white,
    margin: 0,
  },
  h3Dark: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '16px',
    lineHeight: '130%',
    color: FIGMA_COLORS.darkText,
    margin: 0,
  },
  bodyGray: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    fontSize: '13px',
    lineHeight: '170%',
    color: FIGMA_COLORS.grayText,
    margin: 0,
    textAlign: 'justify' as const,
    hyphens: 'auto' as const,
  },
  labelCyan: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '11px',
    lineHeight: '140%',
    color: FIGMA_COLORS.cyanLight,
    letterSpacing: '1px',
    margin: 0,
  },
  labelTeal: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '11px',
    lineHeight: '140%',
    color: FIGMA_COLORS.tealAccent,
    letterSpacing: '1px',
    margin: 0,
  },
  quoteBlock: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    fontStyle: 'italic' as const,
    fontSize: '13px',
    lineHeight: '170%',
    color: FIGMA_COLORS.grayText,
    borderLeft: `3px solid ${FIGMA_COLORS.tealAccent}`,
    backgroundColor: FIGMA_COLORS.subtleBg,
    borderRadius: '4px',
    padding: '12px 20px',
    margin: 0,
  },
  impactPhrase: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '48px',
    lineHeight: '110%',
    color: FIGMA_COLORS.tealDark,
    margin: 0,
  },
  citeText: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '36px',
    lineHeight: '110%',
    color: FIGMA_COLORS.white,
    textAlign: 'center' as const,
    margin: 0,
  },
  displayNumber: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '96px',
    lineHeight: '100%',
    color: FIGMA_COLORS.cyanLight,
    margin: 0,
  },
  statNumber: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: '36px',
    lineHeight: '110%',
    color: FIGMA_COLORS.tealAccent,
    margin: 0,
  },
} as const;
