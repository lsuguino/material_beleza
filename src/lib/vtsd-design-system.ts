/**
 * Design system — Venda Todo Santo Dia (Figma).
 * Materiais A4 PDF: apenas fontes Sora (títulos/números) e Inter (demais textos).
 */

export const VTSD_META = {
  projeto: 'Venda Todo Santo Dia',
  arquivo_figma: 'zUCLefkhX0Fm2xjiXDUmHo',
  google_fonts_import:
    'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
} as const;

export const VTSD_PAGE = {
  formato: 'A4',
  largura_px: 595,
  altura_px: 842,
  dpi: 72,
  fundo_padrao: '#C4C4C4',
  fundo_page: '#FFFFFF',
  overflow: 'hidden' as const,
} as const;

/**
 * Margens e área útil A4 (72 DPI) — PDF / Book DS.
 * Nenhum bloco de conteúdo antes de y=50 nem após y=792; badge fora da área útil (y=812).
 */
export const VTSD_MARGENS_A4 = {
  _secao: 'margens_pagina_a4',
  _descricao:
    'Regras obrigatórias de margem para PDF A4. Nenhum bloco de conteúdo antes de y:50px (topo) nem após y:792px (base). Badge de página fora da área útil, na borda inferior.',

  canvas: {
    largura_px: 595,
    altura_px: 842,
    formato: 'A4',
    dpi: 72,
  },

  margens: {
    topo_px: 50,
    base_px: 50,
    lateral_px: 50,
    _regra:
      'O primeiro bloco de conteúdo começa em y=50. O último termina em y=792 (842−50). Nenhum elemento de conteúdo ultrapassa esses limites.',
  },

  area_util: {
    y_inicio_px: 50,
    y_fim_px: 792,
    altura_px: 742,
    largura_px: 495,
    _nota: 'Largura útil = 595−50−50 = 495px. Usar 515px quando o conteúdo encosta em apenas uma lateral.',
  },

  badge_pagina: {
    y_px: 812,
    x_px: 281,
    largura_px: 33,
    altura_px: 30,
    border_radius: '15px 15px 0 0',
    cor_bg: '#0599A8',
    cor_texto: '#FFFFFF',
    _nota: 'Badge intencionalmente fora da área útil (y=812, após y=792). Encosta na borda inferior.',
  },

  diagrama_ascii: {
    _visualizacao: [
      '┌─────────────────────────────────┐  y: 0px',
      '│  MARGEM TOPO  50px              │',
      '├─────────────────────────────────┤  y: 50px  ← conteúdo começa aqui',
      '│                                 │',
      '│  ÁREA ÚTIL  742px               │',
      '│  (conteúdo, callouts, imagens)  │',
      '│                                 │',
      '├─────────────────────────────────┤  y: 792px ← conteúdo termina aqui',
      '│  MARGEM BASE  50px              │',
      '│         [badge: y=812]          │',
      '└─────────────────────────────────┘  y: 842px',
    ],
  },

  regras_por_layout: {
    layout_hero: {
      descricao: 'Bloco teal de título + faixa visual + corpo de texto',
      primeiro_bloco: { propriedade: 'top', valor_px: 50, variavel: 'Página/Margem-Topo' },
      ultimo_bloco: { propriedade: 'bottom', valor_px: 50, variavel: 'Página/Margem-Base' },
    },
    layout_sidebar: {
      descricao: 'Sidebar teal full-height + coluna de conteúdo',
      sidebar_padding: {
        top_px: 50,
        bottom_px: 50,
        left_px: 50,
        right_px: 24,
        _nota: 'Fundo sidebar 0→842; conteúdo textual entre 50px e 792px.',
      },
      coluna_padding: {
        top_px: 50,
        bottom_px: 50,
        left_px: 20,
        right_px: 50,
      },
    },
    layout_full_width: {
      descricao: 'Blocos full-width empilhados (callout topo + corpo + callout base)',
      container_inner: {
        top_px: 50,
        bottom_px: 50,
        _css: 'top: 50px; bottom: 50px',
        _nota: 'position:absolute com top e bottom; flex interno.',
      },
    },
    layout_magazine: {
      descricao: 'Título teal + 2 colunas + callout base',
      titulo: { top_px: 50 },
      callout_base: { bottom_px: 50, _css: 'bottom: 50px' },
    },
  },

  erros_comuns: {
    conteudo_colado_no_topo: 'Bloco em top:0 em vez de 50px — usar var(--pg-top) ou padding-top:50px.',
    conteudo_colado_na_base: 'Bloco até y=842 — usar bottom: var(--pg-bottom) ou padding-bottom:50px.',
    callout_cobrindo_badge: 'Callout até y=842 cobre badge — callout com bottom:50px.',
    sidebar_sem_respiro: 'Sidebar sem padding-top — usar padding-top:50px.',
    badge_dentro_area_util: 'Badge y<792 — corrigir para badge em y=812 (842−30).',
  },

  figma_variaveis: {
    colecao: 'Book DS — Tokens',
    tokens: {
      'Página/Margem-Topo': 50,
      'Página/Margem-Base': 50,
      'Página/Margem-Lateral': 50,
      'Página/Área-Útil-H': 742,
      'Página/Área-Útil-W': 495,
      'Página/Largura': 595,
      'Página/Altura': 842,
      'Página/Badge-Y': 812,
      'Página/Badge-W': 33,
      'Página/Badge-H': 30,
    },
  },
} as const;

/** Variáveis CSS — margens A4 (alinhadas ao Figma Book DS). */
export const VTSD_MARGENS_CSS_VARS: Record<string, string> = {
  '--pg-top': '50px',
  '--pg-bottom': '50px',
  '--pg-side': '50px',
  '--area-util-h': '742px',
  '--area-util-w': '495px',
};

/** Tokens de marca e aliases editoriais (hex) */
export const VTSD_COLOR = {
  primary: '#03DFE6',
  primary_dark: '#0599A8',
  primary_darker: '#025468',
  primary_light: '#5DECF2',
  primary_lighter: '#B4F8FB',
  teal_tint: '#E2FBFC',
  texto_900: '#0D0D0D',
  texto_800: '#383838',
  texto_700: '#717171',
  texto_600: '#A8A8A8',
  branco: '#FFFFFF',
  fundo_page: '#FFFFFF',
  fundo_box: '#E8E8E8',
  fundo_subtle: '#F6F6F6',
  fundo_dark: '#0C1520',
  fundo_externo: '#C4C4C4',
  /** Fundo da página de boas-vindas institucional (referência marca) */
  intro_page_teal: '#1399A4',
  error: '#E01040',
  warning: '#F5A500',
  success: '#0FA846',
  info: '#1464E8',
} as const;

/** Tipos de página A4 do design system (priorize estes no curso geral / VTSD). */
export const VTSD_LAYOUT_A4 = [
  'A4_1_abertura',
  'A4_2_conteudo_misto',
  'A4_3_sidebar_steps',
  'A4_4_magazine',
  'A4_7_sidebar_conteudo',
] as const;

export type VtsdLayoutA4 = (typeof VTSD_LAYOUT_A4)[number];

/** Variáveis CSS sugeridas no :root (espelho do handoff Figma). */
export const VTSD_CSS_VARS: Record<string, string> = {
  '--fonte-ui-xsmall': '9px',
  '--fonte-ui-small': '10px',
  '--fonte-caption': '11px',
  '--fonte-body-sm': '12px',
  '--fonte-body': '14px',
  '--fonte-label': '16px',
  '--fonte-h3': '20px',
  '--fonte-h2': '24px',
  '--fonte-h1-sm': '34px',
  '--fonte-h1': '40px',
  '--fonte-display': '110px',
  '--entrelinha-ui': '13px',
  '--entrelinha-caption': '14px',
  '--entrelinha-body': '15px',
  '--entrelinha-label': '20px',
  '--entrelinha-h3': '24px',
  '--entrelinha-h2': '30px',
  '--entrelinha-h1-sm': '40px',
  '--entrelinha-h1': '48px',
  '--entrelinha-display': '120px',
  '--espaco-xs': '10px',
  '--espaco-sm': '15px',
  '--espaco-md': '20px',
  '--espaco-lg': '30px',
  '--espaco-xl': '50px',
  '--espaco-xxl': '67px',
  '--gap-xs': '10px',
  '--gap-sm': '11px',
  '--gap-md': '12px',
  '--gap-lg': '13px',
  '--gap-xl': '20px',
  '--radius-pill': '57px',
  '--cor-primary': '#03DFE6',
  '--cor-primary-dark': '#0599A8',
  '--cor-primary-darker': '#025468',
  '--cor-primary-light': '#5DECF2',
  '--cor-primary-lighter': '#B4F8FB',
  '--cor-texto-900': '#0D0D0D',
  '--cor-texto-800': '#383838',
  '--cor-texto-700': '#717171',
  '--cor-fundo-page': '#FFFFFF',
  '--cor-fundo-box': '#E8E8E8',
  '--cor-fundo-subtle': '#F6F6F6',
  '--cor-fundo-dark': '#0C1520',
  '--cor-fundo-externo': '#C4C4C4',
  ...VTSD_MARGENS_CSS_VARS,
};

/**
 * Texto grande na faixa da capa (ex.: "SPIN"): prioriza palavras em maiúsculas no título;
 * senão, iniciais das primeiras palavras significativas.
 */
export function vtsdCoverWatermarkFromTitle(title: string): string {
  const t = title.trim();
  if (!t) return 'VTSD';
  const ascii = t.normalize('NFD').replace(/\p{M}/gu, '');
  const capsWords = ascii.match(/\b[A-ZÀÁÂÃÉÊÍÓÔÚÇ]{2,}\b/g);
  if (capsWords?.length) {
    return capsWords.reduce((best, w) => (w.length >= best.length ? w : best));
  }
  const words = ascii.split(/\s+/).filter((w) => w.length > 1 && !/^\d/.test(w));
  if (words.length === 0) return 'VTSD';
  return words
    .slice(0, 6)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 8);
}
