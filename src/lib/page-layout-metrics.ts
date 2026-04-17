/**
 * Estimador determinístico de altura de blocos em páginas A4 VTSD.
 *
 * Objetivo: permitir paginação por altura útil (em vez de "budget de chars"),
 * respeitando a área editorial de 742×495px definida em VTSD_MARGENS_A4
 * (src/lib/vtsd-design-system.ts) e a tipografia canônica em FIGMA_CSS
 * (src/lib/figma-design-tokens.ts). Sem DOM / getBoundingClientRect —
 * tudo server-side, determinístico.
 *
 * O modelo é intencionalmente conservador (tende a estimar altura
 * levemente MAIOR que a real). Efeito: paginação move texto para próxima
 * página um pouco antes de estourar, em vez de underfillar páginas.
 *
 * Consumido por `src/lib/paginate-content-pages.ts` para decidir onde
 * quebrar `bloco_principal` em páginas de continuação.
 */

// ============================================================
// Tipografia canônica (espelha FIGMA_CSS)
// ============================================================

export type TypoStyle =
  | 'display'   // Sora 700 96px / 100% — número de capítulo (sidebar)
  | 'impact'    // Sora 700 48px / 110% — frase de impacto
  | 'cite'      // Sora 700 36px / 110% — citação destaque
  | 'stat'      // Sora 700 36px / 110% — número estatístico em card
  | 'h1'        // Sora 700 32px / 110% — título de página
  | 'h2'        // Sora 700 22px / 120% — subtítulo, sidebar
  | 'h3'        // Sora 700 16px / 130% — card title, step
  | 'body'      // Inter 400 13px / 170% — parágrafo
  | 'quote'     // Inter 400 italic 13px / 170% — citação em bloco
  | 'label'     // Inter 600 11px / 140% — overline, tag
  | 'badge';    // Inter 600 11px / auto — número página

interface TypoSpec {
  sizePx: number;
  lineHeightPct: number; // 110 => 1.10
  /**
   * Razão "largura média de caractere / tamanho da fonte". Empírico, baseado
   * em medições simples do Inter/Sora em proofing. Mantido conservador
   * (subestima ligeiramente os caracteres finos em italic/condensado,
   * resultando em chars/linha maior → altura estimada menor → leve risco de
   * overflow. Alternativa conservadora: aumentar este valor em ~5%).
   */
  charWidthRatio: number;
}

const TYPO: Record<TypoStyle, TypoSpec> = {
  display: { sizePx: 96, lineHeightPct: 100, charWidthRatio: 0.55 },
  impact:  { sizePx: 48, lineHeightPct: 110, charWidthRatio: 0.55 },
  cite:    { sizePx: 36, lineHeightPct: 110, charWidthRatio: 0.55 },
  stat:    { sizePx: 36, lineHeightPct: 110, charWidthRatio: 0.55 },
  h1:      { sizePx: 32, lineHeightPct: 110, charWidthRatio: 0.55 },
  h2:      { sizePx: 22, lineHeightPct: 120, charWidthRatio: 0.55 },
  h3:      { sizePx: 16, lineHeightPct: 130, charWidthRatio: 0.55 },
  body:    { sizePx: 13, lineHeightPct: 170, charWidthRatio: 0.50 },
  quote:   { sizePx: 13, lineHeightPct: 170, charWidthRatio: 0.52 },
  label:   { sizePx: 11, lineHeightPct: 140, charWidthRatio: 0.55 },
  badge:   { sizePx: 11, lineHeightPct: 120, charWidthRatio: 0.55 },
};

function lineHeightPx(style: TypoStyle): number {
  const t = TYPO[style];
  return t.sizePx * (t.lineHeightPct / 100);
}

function charsPerLine(style: TypoStyle, widthPx: number): number {
  const t = TYPO[style];
  const charPx = t.sizePx * t.charWidthRatio;
  return Math.max(1, Math.floor(widthPx / charPx));
}

function countLines(text: string, style: TypoStyle, widthPx: number): number {
  if (!text) return 0;
  const cpl = charsPerLine(style, widthPx);
  // Considera quebras manuais por \n e soft-wrap por largura.
  const hardLines = text.split('\n');
  let total = 0;
  for (const hl of hardLines) {
    const clean = hl.trim();
    if (!clean) { total += 1; continue; } // linha vazia conta como 1 linha visual
    total += Math.ceil(clean.length / cpl);
  }
  return Math.max(1, total);
}

/** Altura de um texto corrido no estilo dado, dentro de largura widthPx. */
export function estimateTextHeightPx(text: string, widthPx: number, style: TypoStyle = 'body'): number {
  if (!text) return 0;
  return countLines(text, style, widthPx) * lineHeightPx(style);
}

// ============================================================
// Componentes compostos (citação, step, callout, imagem, teal-bar)
// ============================================================

/**
 * Citação em bloco (`FIGMA_CSS.quoteBlock`):
 * padding 12px top + 12px bottom, border-left 3px (não afeta altura),
 * body em italic 13px/170%, border-radius 4.
 */
export function estimateQuoteBlockHeightPx(text: string, widthPx: number): number {
  const padV = 12 + 12;
  // padding horizontal 20×2 = 40 já reduz a largura utilizável
  const innerW = Math.max(100, widthPx - 40);
  return padV + estimateTextHeightPx(text, innerW, 'quote');
}

/**
 * Callout/"card" teal escuro com 12–16px padding vertical + body em cyanLight/white.
 * Usado para "CONCEITO-CHAVE" (A4_4_magazine) e destaques em A4_7_sidebar_conteudo.
 */
export function estimateCalloutBlockHeightPx(text: string, widthPx: number, withLabel = false): number {
  const padV = 16 + 16;
  const labelPx = withLabel ? lineHeightPx('label') + 6 /* margin */ : 0;
  const innerW = Math.max(100, widthPx - 40);
  return padV + labelPx + estimateTextHeightPx(text, innerW, 'body');
}

/**
 * Item numerado "01 Diagnóstico: identificar a dor" em sidebar-conteudo/steps.
 * Número label (teal) + body wrap, com gap interno.
 */
export function estimateNumberedItemHeightPx(text: string, widthPx: number): number {
  // Largura disponível para o body descontando a coluna do número (~36px)
  const bodyW = Math.max(80, widthPx - 36);
  const labelPx = lineHeightPx('label');
  const textPx = estimateTextHeightPx(text, bodyW, 'body');
  // Altura do bloco = max(labelPx, textPx) quando inline; em layouts verticais (stacked),
  // somamos. Aqui assumimos inline (labelTeal minWidth 24 + body wrap).
  return Math.max(labelPx, textPx);
}

/**
 * Step numerado vertical "01\nDiagnóstico\nidentificar a dor real" (A4_3_sidebar_steps).
 * stat number (20px) + h3 (16px/130%) + body (13px/170%) + 12px paddingBottom + 1px border.
 */
export function estimateStepItemHeightPx(text: string, widthPx: number): number {
  // split "head: body"
  const sep = text.search(/[:\-–]/);
  const head = sep > 0 ? text.slice(0, sep).trim() : text.trim();
  const body = sep > 0 ? text.slice(sep + 1).trim() : '';
  const numH = 20; // stat 20px × 1 line
  const headH = estimateTextHeightPx(head, widthPx, 'h3');
  const bodyH = body ? estimateTextHeightPx(body, widthPx, 'body') : 0;
  const gaps = 4 + 4; // entre num→head e head→body
  const paddingBottom = 12;
  const border = 1;
  return numH + gaps + headH + bodyH + paddingBottom + border;
}

/** Imagem placeholder (se presente). Altura fixa por layout. */
export function estimateImagePlaceholderHeightPx(heightPx: number, marginBottomPx = 20): number {
  return heightPx + marginBottomPx;
}

/** Barra teal fina (`FIGMA_CSS.tealBarThin`) — 6px. */
export const TEAL_BAR_THIN_HEIGHT_PX = 6;

/** Separator "accent line" (3px). */
export const ACCENT_LINE_HEIGHT_PX = 3;

// ============================================================
// Área útil (VTSD_MARGENS_A4.area_util)
// ============================================================

/** Altura da área útil da página A4 (50..792). */
export const PAGE_USABLE_HEIGHT_PX = 742;
/** Largura da área útil da página A4 (50..545). */
export const PAGE_USABLE_WIDTH_PX = 495;

// ============================================================
// Budget por layout — descontando áreas fixas do 742px
// ============================================================

export interface PageLike {
  titulo?: string;
  subtitulo?: string;
  citacao?: string;
  itens?: string[];
  destaques?: string[];
  imagem_url?: string;
  sugestao_imagem?: unknown;
  capitulo_seq?: number;
  continuacao?: boolean;
}

/**
 * Retorna a altura em px disponível para `bloco_principal` (parágrafos de corpo)
 * num dado layout, descontando header, sidebar (quando horizontal), imagem,
 * citação, itens, callouts e paddings verticais do body.
 *
 * Assume que `bloco_principal` é renderizado em coluna de largura
 * `bodyWidthForLayout(layout)`.
 *
 * Valores baseados na implementação atual de `FigmaTemplateRenderer.tsx` e
 * no spec `docs/figma-source-of-truth.json`.
 */
export function bodyBudgetPxForLayout(layout: string, page: PageLike): number {
  const BODY_PADDING_TOP_STD = 30;
  const BODY_PADDING_BOTTOM_STD = 20;

  switch (layout) {
    // ---------- A4_2_continuacao ----------
    // TealBar(6) + body[pad 30/50/50/50 spacing 20] + TealBar(6)
    case 'A4_2_continuacao': {
      const fixed = TEAL_BAR_THIN_HEIGHT_PX * 2 + 30 + 50; // paddings verticais do body
      let reserved = 0;
      if (page.citacao) reserved += estimateQuoteBlockHeightPx(page.citacao, PAGE_USABLE_WIDTH_PX);
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - fixed - reserved);
    }

    // ---------- A4_2_conteudo_misto ----------
    // Header teal [dica] (pad 20/50/20/50 spacing 8) + Body white + Footer teal [exercicio]
    case 'A4_2_conteudo_misto': {
      const dicaText = page.destaques?.[0] ?? '';
      const exText   = page.destaques?.[1] ?? page.itens?.[0] ?? '';
      const labelPx  = lineHeightPx('label');
      const dicaH = 20 + 20 + labelPx + 8 + estimateTextHeightPx(dicaText || 'Dica do Autor',
                                                                  PAGE_USABLE_WIDTH_PX, 'body');
      const exH   = 20 + 20 + labelPx + 8 + estimateTextHeightPx(exText || 'Exercício Prático',
                                                                  PAGE_USABLE_WIDTH_PX, 'body');
      const bodyPadding = BODY_PADDING_TOP_STD + BODY_PADDING_BOTTOM_STD;
      let reserved = 0;
      if (page.citacao) reserved += estimateQuoteBlockHeightPx(page.citacao, PAGE_USABLE_WIDTH_PX);
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - dicaH - exH - bodyPadding - reserved);
    }

    // ---------- A4_2_texto_corrido ----------
    // body[pad 50/50/20/50 spacing 20]: h1Teal + accent-line + paragrafos + (h3 + paragrafos)
    case 'A4_2_texto_corrido': {
      const bodyPadding = 50 + 20;
      const titleH = estimateTextHeightPx(page.titulo || '', PAGE_USABLE_WIDTH_PX, 'h1');
      const titleGap = 8;
      const accent = ACCENT_LINE_HEIGHT_PX + 20;
      let reserved = 0;
      if (page.citacao) reserved += estimateQuoteBlockHeightPx(page.citacao, PAGE_USABLE_WIDTH_PX) + 12;
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - bodyPadding - titleH - titleGap - accent - reserved);
    }

    // ---------- A4_2_texto_citacao ----------
    // Header teal (pad 40/50/30/50 spacing 8) + body [pad 30/50/20/50 spacing 20]
    case 'A4_2_texto_citacao': {
      // header: label-teal + h1White
      const labelPx = lineHeightPx('label');
      const titleH  = estimateTextHeightPx(page.titulo || '', PAGE_USABLE_WIDTH_PX, 'h1');
      const headerH = 40 + 30 + labelPx + 8 + titleH;
      const bodyPadding = 30 + 20;
      let reserved = 0;
      if (page.citacao) reserved += estimateQuoteBlockHeightPx(page.citacao, PAGE_USABLE_WIDTH_PX) + 12;
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - headerH - bodyPadding - reserved);
    }

    // ---------- A4_2_texto_sidebar ----------
    // Sidebar 60px + content 535 [pad 50/50/50/30 spacing 20]: label + h1 + paragrafos
    case 'A4_2_texto_sidebar': {
      // body fica dentro da coluna de conteúdo (width 535, padding 50+30 → inner 455)
      const bodyPadding = 50 + 50;
      const labelPx = lineHeightPx('label');
      const titleH  = estimateTextHeightPx(page.titulo || '', 455, 'h1');
      const headerBlock = labelPx + 8 + titleH + 16;
      let reserved = 0;
      if (page.citacao) reserved += estimateQuoteBlockHeightPx(page.citacao, 455) + 12;
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - bodyPadding - headerBlock - reserved);
    }

    // ---------- A4_2_imagem_texto / A4_2_texto_imagem ----------
    // Imagem 300px topo + body [pad 30/50/20/50]: legenda-bar + h2 + paragrafos
    case 'A4_2_texto_imagem':
    case 'A4_2_imagem_texto': {
      const imageH = 300;
      const bodyPadding = 30 + 20;
      const legendaPx = lineHeightPx('label') + 12;
      const titleH = estimateTextHeightPx(page.titulo || '', PAGE_USABLE_WIDTH_PX, 'h2');
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - imageH - bodyPadding - legendaPx - titleH - 16);
    }

    // ---------- A4_1_abertura ----------
    // Header teal + body (imagem opcional 260 + paragrafos)
    case 'A4_1_abertura': {
      const labelPx = lineHeightPx('label');
      const titleH  = estimateTextHeightPx(page.titulo || '', PAGE_USABLE_WIDTH_PX, 'h1');
      const subPx   = page.subtitulo ? lineHeightPx('label') + 12 : 0;
      const headerH = 40 + 30 + labelPx + 8 + titleH + subPx;
      const bodyPadding = 30 + 20;
      const imageH = page.imagem_url ? estimateImagePlaceholderHeightPx(260, 20) : 0;
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - headerH - bodyPadding - imageH);
    }

    // ---------- A4_3_sidebar_steps ----------
    // Sidebar 225 + coluna 370 [pad 50/50/30/20]: lista de steps numerados
    case 'A4_3_sidebar_steps': {
      const colWidth = 370 - 50 - 20;
      const bodyPadding = 50 + 30;
      const steps = (page.itens && page.itens.length ? page.itens : page.destaques) ?? [];
      const gap = 16;
      const stepsH = steps.slice(0, 6).reduce((acc, s, i) =>
        acc + estimateStepItemHeightPx(String(s), colWidth) + (i > 0 ? gap : 0), 0);
      // paragrafos extras (se houver) disputam o que sobra
      return Math.max(100, PAGE_USABLE_HEIGHT_PX - bodyPadding - stepsH);
    }

    // ---------- A4_4_magazine ----------
    // Header [pad 50/50/20/50] h1 + body [pad 0/50/20/50 spacing 20]: imagem + paras + callout
    case 'A4_4_magazine': {
      const headerPadding = 50 + 20;
      const titleH = estimateTextHeightPx(page.titulo || '', PAGE_USABLE_WIDTH_PX, 'h1');
      const bodyPadding = 20;
      const imageH = page.imagem_url ? estimateImagePlaceholderHeightPx(220, 20) : 0;
      const calloutH = page.destaques?.[0]
        ? estimateCalloutBlockHeightPx(page.destaques[0], PAGE_USABLE_WIDTH_PX, /*withLabel*/ true) + 20
        : 0;
      return Math.max(120, PAGE_USABLE_HEIGHT_PX - headerPadding - titleH - bodyPadding - imageH - calloutH);
    }

    // ---------- A4_7_sidebar_conteudo ----------
    // Sidebar 225 + coluna 370 [pad 50/50/30/20 spacing 20]: paras + pullquote + items + callout
    case 'A4_7_sidebar_conteudo': {
      const colWidth = 370 - 50 - 20;
      const bodyPadding = 50 + 30;
      let reserved = 0;
      if (page.citacao) reserved += estimateQuoteBlockHeightPx(page.citacao, colWidth) + 20;
      const itens = page.itens ?? [];
      if (itens.length) {
        const itemGap = 10;
        reserved += itens.slice(0, 4).reduce((acc, it, i) =>
          acc + estimateNumberedItemHeightPx(String(it), colWidth) + (i > 0 ? itemGap : 0), 0) + 20;
      }
      if (page.destaques?.[0]) {
        reserved += estimateCalloutBlockHeightPx(page.destaques[0], colWidth, /*withLabel*/ false) + 20;
      }
      return Math.max(100, PAGE_USABLE_HEIGHT_PX - bodyPadding - reserved);
    }

    // ---------- A4_4_destaque_numerico / A4_8_citacao_destaque / A4_8_frase_impacto ----------
    // Layouts "curtos" — cabem numa folha, não costumam virar continuação.
    // Para paginador, retorna um budget baixo para desencorajar split.
    case 'A4_4_destaque_numerico':
    case 'A4_8_citacao_destaque':
    case 'A4_8_frase_impacto':
      return 300;

    // ---------- Default (layouts fora do pool) ----------
    // Conservador: área útil padrão menos paddings.
    default:
      return PAGE_USABLE_HEIGHT_PX - 120;
  }
}

/**
 * Largura (em px) usada para renderizar `bloco_principal` no layout dado.
 * Necessária para calcular `charsPerLine` no splitter por altura.
 */
export function bodyWidthForLayout(layout: string): number {
  switch (layout) {
    // Layouts com sidebar 225 → coluna de conteúdo 370 com pad lat (50+20) → inner 300
    case 'A4_3_sidebar_steps':
    case 'A4_7_sidebar_conteudo':
      return 300;
    // Layouts com sidebar fina 60 → coluna 535 com pad lat (50+30) → inner 455
    case 'A4_2_texto_sidebar':
      return 455;
    // Layouts full-width default
    default:
      return PAGE_USABLE_WIDTH_PX;
  }
}

/**
 * Altura estimada de um conjunto de parágrafos (com gap entre eles).
 * Usada pelo splitter por altura.
 */
export function estimateParagraphsHeightPx(
  paragraphs: string[],
  widthPx: number,
  style: TypoStyle = 'body',
  gapPx = 12,
): number {
  if (!paragraphs.length) return 0;
  let total = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    total += estimateTextHeightPx(p, widthPx, style);
    if (i < paragraphs.length - 1) total += gapPx;
  }
  return total;
}

/**
 * Meta de fill ratio (70–85%) — documentada no PR "Paginação por altura".
 * Usado para decidir se uma página tem "respiro" suficiente sem ser subfill.
 */
export const FILL_RATIO_MIN = 0.70;
export const FILL_RATIO_MAX = 0.85;

/** Ratio estimado de preenchimento de um corpo (0..1+). */
export function fillRatioPx(usedPx: number, budgetPx: number): number {
  if (budgetPx <= 0) return 0;
  return usedPx / budgetPx;
}
