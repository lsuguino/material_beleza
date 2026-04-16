'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import { ContentBlocksRenderer, type ContentBlockItem } from '@/components/ContentBlocksRenderer';
import type { LayoutTipo } from '@/lib/design-agent';
import { excerptDistinctFromSources } from '@/lib/dedupe-vtt-excerpts';
import { isRenderableImageUrl } from '@/lib/image-url';
import { VTSD_COLOR, VTSD_MARGENS_A4 } from '@/lib/vtsd-design-system';
import { getIconById } from '@/lib/icons-map';

const PG = VTSD_MARGENS_A4.margens.topo_px;
const SIDE = VTSD_MARGENS_A4.margens.lateral_px;
const AREA_W = VTSD_MARGENS_A4.area_util.largura_px;

/** Limita texto a maxChars, cortando no fim da frase mais próxima. Adiciona "..." se truncado. */
function truncateAtSentence(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  const region = text.slice(0, maxChars);
  // Tenta cortar no fim de frase
  const sentEnd = Math.max(
    region.lastIndexOf('. '),
    region.lastIndexOf('! '),
    region.lastIndexOf('? '),
  );
  if (sentEnd > maxChars * 0.4) return region.slice(0, sentEnd + 1);
  // Fallback: corta no último espaço
  const spaceEnd = region.lastIndexOf(' ');
  if (spaceEnd > maxChars * 0.4) return region.slice(0, spaceEnd) + '...';
  return region + '...';
}

/** Limita array de parágrafos a um total de maxChars, truncando o último se necessário. */
function limitParagraphs(paras: string[], maxChars: number): string[] {
  const result: string[] = [];
  let total = 0;
  for (const p of paras) {
    if (total >= maxChars) break;
    const remaining = maxChars - total;
    if (p.length <= remaining) {
      result.push(p);
      total += p.length;
    } else {
      const truncated = truncateAtSentence(p, remaining);
      if (truncated.length > 20) result.push(truncated);
      break;
    }
  }
  return result;
}

function createMeasureRoot(widthPx: number, heightPx: number): HTMLDivElement {
  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.left = '-10000px';
  root.style.top = '0';
  root.style.width = `${widthPx}px`;
  root.style.height = `${heightPx}px`;
  root.style.overflow = 'hidden';
  root.style.visibility = 'hidden';
  root.style.pointerEvents = 'none';
  root.style.background = '#fff';
  root.style.boxSizing = 'border-box';
  // Defaults similares aos parágrafos VTSD
  root.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  root.style.fontSize = '13px';
  root.style.lineHeight = '22px';
  root.style.textAlign = 'justify';
  (root.style as unknown as { hyphens?: string }).hyphens = 'auto';
  return root;
}

function appendParagraph(root: HTMLElement, text: string, opts?: { italic?: boolean }) {
  const p = document.createElement('p');
  p.style.margin = '0 0 12px 0';
  p.style.padding = '0';
  if (opts?.italic) p.style.fontStyle = 'italic';
  p.textContent = text;
  root.appendChild(p);
}

function fitParagraphsByMeasuring(args: {
  paragraphs: string[];
  buildStatic: (root: HTMLDivElement) => void;
  maxHeightPx: number;
  widthPx: number;
}): string[] {
  const { paragraphs, buildStatic, maxHeightPx, widthPx } = args;
  if (paragraphs.length === 0) return [];
  const root = createMeasureRoot(widthPx, maxHeightPx);
  document.body.appendChild(root);
  try {
    const fits = (count: number) => {
      root.innerHTML = '';
      buildStatic(root);
      for (let i = 0; i < count; i++) appendParagraph(root, paragraphs[i] ?? '');
      return root.scrollHeight <= root.clientHeight + 1;
    };

    // Busca binária pelo maior prefixo que cabe.
    let lo = 0;
    let hi = paragraphs.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(mid)) lo = mid;
      else hi = mid - 1;
    }
    return paragraphs.slice(0, Math.max(1, lo));
  } finally {
    root.remove();
  }
}

/** Página de continuação: último parágrafo curto vira citação em caixa (estilo Print 1). */
function splitContinuationBodyQuote(paragraphs: string[]): { body: string[]; quote?: string } {
  const paras = paragraphs.map((s) => s.trim()).filter(Boolean);
  if (paras.length >= 2) {
    const last = paras[paras.length - 1];
    if (last.length <= 380 && last.length >= 16) {
      return { body: paras.slice(0, -1), quote: last };
    }
  }
  return { body: paras };
}

/** Objeto tema com cores (ex.: CourseTheme) */
export interface TemaPagina {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
  name?: string;
}

/** Sugestão de gráfico vinda da IA de conteúdo */
export interface SugestaoGraficoPagina {
  tipo: 'barra' | 'pizza' | 'linha';
  titulo: string;
  labels: string[];
  valores: number[];
}

/** Sugestão de fluxograma */
export interface SugestaoFluxogramaPagina {
  titulo: string;
  etapas: string[];
}

/** Sugestão de tabela */
export interface SugestaoTabelaPagina {
  titulo: string;
  colunas: string[];
  linhas: string[][];
}

/** Página com conteúdo + campos de design + sugestões visuais */
export interface PaginaComDesign {
  layout_tipo: LayoutTipo;
  cor_fundo_principal: string;
  cor_fundo_destaque: string;
  cor_texto_principal: string;
  cor_texto_destaque: string;
  icone_sugerido: string;
  proporcao_colunas?: '60/40' | '50/50' | '70/30';
  /** Conteúdo textual da página */
  titulo?: string;
  subtitulo?: string;
  paragrafos?: string[];
  destaques?: string[];
  citacao?: string;
  itens?: string[];
  /** Sugestões visuais da IA de conteúdo (preservadas pelo design) */
  sugestao_imagem?: string;
  prompt_imagem?: string;
  /** Data URL — etapa 3 (Gemini Nano Banana) */
  imagem_url?: string;
  /** Dimensões customizadas da imagem (definidas pelo usuário via resize) */
  imagem_width?: number;
  imagem_height?: number;
  sugestao_grafico?: SugestaoGraficoPagina;
  sugestao_fluxograma?: SugestaoFluxogramaPagina;
  sugestao_tabela?: SugestaoTabelaPagina;
  sugestao_icone?: string;
  /** Barra lateral direita colorida (estilo "TABLE OF CONTENT") */
  usar_barra_lateral?: boolean;
  /** Faixa decorativa chevron/zigzag no rodapé */
  usar_faixa_decorativa?: boolean;
  /** Blocos chart/mermaid/image (gerados) renderizados no layout A4 */
  extraContentBlocks?: ContentBlockItem[];
  [key: string]: unknown;
}

interface PageConteudoProps {
  pagina: PaginaComDesign;
  tema: TemaPagina;
  numeroPagina: number;
  nomeCurso: string;
  /** Índice do capítulo na ordem do sumário (1-based), alinhado às entradas do TOC */
  capituloNumero?: number;
}

/** Renderiza ícone SVG do material pelo ID (icone_sugerido) */
function MaterialIconSvg({ iconId, size = 20, className = '' }: { iconId?: string; size?: number; className?: string }) {
  if (!iconId) return null;
  const icon = getIconById(iconId);
  if (!icon) return null;
  return (
    <img
      src={icon.path}
      alt={icon.name}
      width={size}
      height={size}
      className={`inline-block flex-shrink-0 ${className}`}
      style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
      aria-hidden
    />
  );
}

type VtsdChapterSidebarProps = {
  widthPx: number;
  capituloNumero: number;
  titulo: string;
  subtitulo?: string;
  nomeCurso: string;
  blocoEscuro: string;
  blocoMedio: string;
};

/** Barra teal lateral: CAPÍTULO + título (como no sumário) + marca rodapé — padrão VTSD / referência Figma */
function VtsdChapterSidebar({
  widthPx,
  capituloNumero,
  titulo,
  subtitulo,
  nomeCurso: _nomeCurso,
  blocoEscuro,
  blocoMedio,
}: VtsdChapterSidebarProps) {
  const wide = widthPx >= 300;
  const pad = wide ? '50px 40px 20px 50px' : '40px 16px 18px 18px';
  const titlePx = wide ? 32 : 22;
  const titleLead = wide ? 35 : 26;
  const numPx = wide ? 96 : 72;
  const subPx = wide ? 16 : 13;
  return (
    <aside
      className="flex flex-col justify-between flex-shrink-0 h-full min-h-0"
      style={{
        width: widthPx,
        backgroundColor: blocoEscuro,
        padding: pad,
        boxSizing: 'border-box',
      }}
      aria-label={`Capítulo ${capituloNumero}: ${titulo}`}
    >
      <div className="min-w-0">
        <p className="font-display font-semibold text-[9px] leading-[13px] text-white m-0 tracking-[0.14em]">
          CAPÍTULO {capituloNumero}
        </p>
        <h1
          lang="pt-BR"
          className="font-sora font-bold text-white m-0 mt-3 max-w-full hyphens-auto break-words [overflow-wrap:anywhere]"
          style={{
            fontSize: titlePx,
            lineHeight: `${titleLead}px`,
            letterSpacing: '-0.025em',
          }}
        >
          {titulo || ''}
        </h1>
        {subtitulo ? (
          <p
            className="font-display m-0 mt-3"
            style={{
              fontSize: subPx,
              lineHeight: wide ? '26px' : '22px',
              color: VTSD_COLOR.teal_tint,
            }}
          >
            {subtitulo}
          </p>
        ) : null}
      </div>
      <div className="relative min-h-0">
        <span
          className="font-sora font-bold block select-none opacity-[0.35]"
          style={{
            color: blocoMedio,
            fontSize: numPx,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}
          aria-hidden
        >
          {String(capituloNumero).padStart(2, '0')}
        </span>
      </div>
    </aside>
  );
}

function getProporcaoClasses(proporcao?: string): { left: string; right: string } {
  switch (proporcao) {
    case '70/30':
      return { left: 'w-[70%]', right: 'w-[30%]' };
    case '50/50':
      return { left: 'w-1/2', right: 'w-1/2' };
    case '60/40':
    default:
      return { left: 'w-[60%]', right: 'w-[40%]' };
  }
}

/** Faixa decorativa chevron/zigzag na cor do curso */
function FaixaChevron({ cor }: { cor: string }) {
  return (
    <div className="w-full flex-shrink-0 h-3 flex items-center" style={{ backgroundColor: cor }} aria-hidden>
      <svg width="100%" height="12" viewBox="0 0 120 12" fill="rgba(255,255,255,0.4)" preserveAspectRatio="none">
        <path d="M0 6 L10 0 L20 6 L30 0 L40 6 L50 0 L60 6 L70 0 L80 6 L90 0 L100 6 L110 0 L120 6 L120 12 L0 12 Z" />
      </svg>
    </div>
  );
}

/** Passos numerados (círculos) — A4_3 e colunas que exibem "itens" */
function VtsdNumberedSteps({
  steps,
  blocoMedio,
  max = 4,
  className = '',
}: {
  steps: string[];
  blocoMedio: string;
  max?: number;
  className?: string;
}) {
  if (!steps.length) return null;
  return (
    <div className={`space-y-2.5 mt-2 ${className}`.trim()}>
      {steps.slice(0, max).map((step, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-sora font-bold text-[13px] text-white"
            style={{ backgroundColor: blocoMedio }}
          >
            {i + 1}
          </span>
          <p className="font-display text-[13px] leading-[22px] m-0 pt-1.5 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_800 }}>
            {step}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Badge de numeração — fora da área útil (y=812), Book DS */
function BadgePagina({ numero, bg = VTSD_COLOR.primary_dark, naked = false }: { numero: number; bg?: string; naked?: boolean }) {
  const b = VTSD_MARGENS_A4.badge_pagina;
  // naked = true: só o número branco sem frame (para páginas de abertura com fundo escuro)
  if (naked) {
    return (
      <div
        className="absolute z-[2] flex items-center justify-center font-display font-semibold text-[11px] leading-[14px] text-white pointer-events-none"
        style={{ left: b.x_px, top: b.y_px, width: b.largura_px, height: b.altura_px }}
        aria-hidden
      >
        {numero}
      </div>
    );
  }
  return (
    <div
      className="absolute z-[2] flex items-center justify-center font-display font-semibold text-[11px] leading-[14px] text-white pointer-events-none"
      style={{
        left: b.x_px,
        top: b.y_px,
        width: b.largura_px,
        height: b.altura_px,
        backgroundColor: b.cor_bg,
        color: b.cor_texto,
        borderRadius: b.border_radius,
      }}
      aria-hidden
    >
      {numero}
    </div>
  );
}

export function PageConteudo({
  pagina,
  tema,
  numeroPagina,
  nomeCurso,
  capituloNumero: capituloNumeroProp,
}: PageConteudoProps) {
  const capituloNumero = capituloNumeroProp ?? 1;
  const {
    layout_tipo,
    cor_fundo_principal,
    cor_fundo_destaque,
    cor_texto_principal,
    cor_texto_destaque,
    titulo,
    paragrafos = [],
    destaques = [],
    citacao,
    itens = [],
    sugestao_imagem,
    prompt_imagem,
    imagem_url: imagemUrlPagina,
    sugestao_grafico,
    sugestao_fluxograma,
    sugestao_tabela,
    usar_barra_lateral,
    usar_faixa_decorativa,
    subtitulo,
    extraContentBlocks = [],
    imagem_width: customImgW,
    imagem_height: customImgH,
  } = pagina;

  const imagemGerada = isRenderableImageUrl(imagemUrlPagina) ? imagemUrlPagina.trim() : undefined;

  // Deduplicate: remove paragraphs that are just numbered list items already in itens/destaques
  const structuredTexts = new Set([...itens, ...destaques].map((s) => s.toLowerCase().trim().slice(0, 60)));
  const filteredParagrafos = paragrafos.filter((p) => {
    const clean = p.replace(/^\d+[.)]\s*/, '').toLowerCase().trim().slice(0, 60);
    // Remove paragraphs that are duplicates of items or are just number markers
    return !structuredTexts.has(clean) && !/^\d+[.)]*\s*$/.test(p.trim());
  });

  const [fitParasState, setFitParasState] = useState<Record<string, string[]>>({});

  const fitKey = useMemo(() => {
    const sig = filteredParagrafos.join('\n').slice(0, 1400);
    const hasImg = Boolean(imagemGerada);
    const hasQuote = Boolean(String(citacao ?? '').trim());
    const hasTop = Boolean(String(destaques?.[0] ?? '').trim());
    const hasBottom = Boolean(String(destaques?.[1] ?? '').trim());
    return `${layout_tipo}|p=${filteredParagrafos.length}|img=${hasImg ? 1 : 0}|q=${hasQuote ? 1 : 0}|t=${hasTop ? 1 : 0}|b=${hasBottom ? 1 : 0}|${sig}`;
  }, [layout_tipo, filteredParagrafos, imagemGerada, citacao, destaques]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    if (!filteredParagrafos.length) return;
    // Executa fit apenas para layouts VTSD que hoje truncam agressivamente.
    const layout = String(layout_tipo || '');
    if (layout !== 'A4_2_continuacao' && layout !== 'A4_2_conteudo_misto' && layout !== 'A4_7_sidebar_conteudo') return;
    if (fitParasState[fitKey]) return;

    try {
      // Área útil base (y=50..792). Ajustes por layout abaixo.
      const pageH = VTSD_MARGENS_A4.canvas.altura_px;
      const areaTop = VTSD_MARGENS_A4.margens.topo_px;
      const areaBottom = VTSD_MARGENS_A4.margens.base_px;
      const areaH = pageH - areaTop - areaBottom;

      if (layout === 'A4_2_continuacao') {
        // Continuacao: barra 6px + paddingTop 30 + paddingBottom PG dentro do body.
        const barH = 6;
        const padTop = 30;
        const padBottom = VTSD_MARGENS_A4.margens.base_px;
        const maxH = areaH - barH - padTop - Math.max(0, padBottom - 10);
        const width = VTSD_MARGENS_A4.area_util.largura_px;
        const fitted = fitParagraphsByMeasuring({
          paragraphs: filteredParagrafos,
          widthPx: width,
          maxHeightPx: Math.max(120, maxH),
          buildStatic: (_root) => {
            // Sem elementos estáticos aqui: quote/steps entram abaixo no render real.
          },
        });
        setFitParasState((s) => ({ ...s, [fitKey]: fitted }));
        return;
      }

      if (layout === 'A4_2_conteudo_misto') {
        // Conteúdo misto: sidebar + coluna; topo (dica) opcional; quote opcional; imagem opcional.
        const sidebarW = 236;
        const colPadLeft = 20;
        const colPadRight = VTSD_MARGENS_A4.margens.lateral_px;
        const colW = VTSD_MARGENS_A4.canvas.largura_px - sidebarW - colPadLeft - colPadRight;

        // Reserva vertical aproximada dos blocos “fixos” desse layout.
        const hasTopBand = Boolean(String(destaques?.[0] ?? '').trim());
        const hasQuote = Boolean(String(citacao ?? '').trim());
        const hasImg = Boolean(imagemGerada);
        const topBandReserve = hasTopBand ? 120 : 0;
        const quoteReserve = hasQuote ? 140 : 0;
        const imgReserve = hasImg ? 150 : 0;
        const baseReserve = 90; // paddings/margens internas
        const maxH = Math.max(140, areaH - topBandReserve - quoteReserve - imgReserve - baseReserve);

        const fitted = fitParagraphsByMeasuring({
          paragraphs: filteredParagrafos,
          widthPx: Math.max(180, colW),
          maxHeightPx: maxH,
          buildStatic: (_root) => {
            // Static blocks reservados via maxH; nada a renderizar aqui.
          },
        });
        setFitParasState((s) => ({ ...s, [fitKey]: fitted }));
        return;
      }

      if (layout === 'A4_7_sidebar_conteudo') {
        // Sidebar conteúdo: coluna principal mais larga; pode ter steps/quote.
        const sidebarW = 225;
        const colPadLeft = 20;
        const colPadRight = VTSD_MARGENS_A4.margens.lateral_px;
        const colW = VTSD_MARGENS_A4.canvas.largura_px - sidebarW - colPadLeft - colPadRight;
        const hasQuote = Boolean(String(citacao ?? '').trim());
        const hasSteps = Array.isArray(itens) && itens.length > 0;
        const quoteReserve = hasQuote ? 140 : 0;
        const stepsReserve = hasSteps ? 220 : 0;
        const baseReserve = 90;
        const maxH = Math.max(160, areaH - quoteReserve - stepsReserve - baseReserve);

        const fitted = fitParagraphsByMeasuring({
          paragraphs: filteredParagrafos,
          widthPx: Math.max(200, colW),
          maxHeightPx: maxH,
          buildStatic: (_root) => {},
        });
        setFitParasState((s) => ({ ...s, [fitKey]: fitted }));
      }
    } catch {
      // Se medição falhar (fonts não carregadas, etc.), mantém fallback por chars.
    }
  }, [layout_tipo, filteredParagrafos, fitKey, fitParasState, imagemGerada, citacao, destaques, itens]);

  const proporcao = getProporcaoClasses(pagina.proporcao_colunas);
  const blocoEscuro = tema.primaryDark || VTSD_COLOR.primary_darker;
  const blocoMedio = tema.primary || VTSD_COLOR.primary_dark;
  const cyanMarca = tema.primaryLight || VTSD_COLOR.primary;

  // ——— Mapeamento: TODOS os layouts → renderizadores VTSD (nunca legados) ———
  // Os novos templates são renderizados pelo FigmaTemplateRenderer primeiro.
  // Se não tiver renderizador Figma dedicado, cai aqui nos 5 VTSD base.
  const LAYOUT_MAP: Record<string, string> = {
    // Aberturas
    'A4_1_abertura_split': 'A4_3_sidebar_steps',
    'A4_1_abertura_imagem': 'A4_1_abertura',
    'A4_1_abertura_invertida': 'A4_7_sidebar_conteudo',
    'A4_1_abertura_full': 'A4_1_abertura',
    // Texto (os que não têm FigmaTemplate dedicado)
    'A4_2_duas_colunas': 'A4_7_sidebar_conteudo',
    'A4_2_duas_colunas_num': 'A4_7_sidebar_conteudo',
    // Sidebar/Processo
    'A4_3_processo_etapas': 'A4_3_sidebar_steps',
    // Dados visuais
    'A4_4_cards_grid': 'A4_4_magazine',
    'A4_4_comparativo': 'A4_2_conteudo_misto',
    'A4_4_pros_contras': 'A4_2_conteudo_misto',
    // Diagramas
    'A4_5_tabela': 'A4_4_magazine',
    'A4_5_organograma': 'A4_4_magazine',
    'A4_5_mapa_mental': 'A4_4_magazine',
    'A4_5_timeline': 'A4_3_sidebar_steps',
    'A4_5_infografico': 'A4_4_magazine',
    'A4_5_grafico_analise': 'A4_4_magazine',
    // Listas e FAQ
    'A4_6_faq': 'A4_2_conteudo_misto',
    'A4_6_lista_icones': 'A4_7_sidebar_conteudo',
    'A4_6_texto_completo': 'A4_2_conteudo_misto',
    // Destaques (os que não têm FigmaTemplate dedicado)
    'A4_8_nota_importante': 'A4_2_conteudo_misto',
    'A4_8_testemunho': 'A4_2_conteudo_misto',
    'A4_8_imagem_overlay': 'A4_4_magazine',
    'A4_8_imagem_sidebar': 'A4_7_sidebar_conteudo',
    // Atividades
    'A4_9_checklist': 'A4_2_conteudo_misto',
    'A4_9_exercicio': 'A4_2_conteudo_misto',
    'A4_9_resumo_capitulo': 'A4_2_conteudo_misto',
    'A4_9_conceitos_chave': 'A4_7_sidebar_conteudo',
    // Sumário
    'A4_0_sumario': 'A4_2_conteudo_misto',
    // Legados → redirecionar para VTSD
    'header_destaque': 'A4_2_conteudo_misto',
    'dois_colunas': 'A4_7_sidebar_conteudo',
    'citacao_grande': 'A4_2_conteudo_misto',
    'lista_icones': 'A4_7_sidebar_conteudo',
    'dados_grafico': 'A4_4_magazine',
    'imagem_lateral': 'A4_4_magazine',
    'imagem_top': 'A4_4_magazine',
  };

  // Resolve o layout efetivo: se é um novo tipo, mapeia para um renderizador existente
  const layoutEfetivo = LAYOUT_MAP[layout_tipo] || layout_tipo;

  // ——— Layouts A4 design system VTSD (Figma) ———
  if (layoutEfetivo === 'A4_1_abertura') {
    // Figma A4-1: split horizontal no topo (esquerda teal 370px / direita cinza 225px),
    // imagem full-width abaixo do split, texto corrido no rodapé.
    const IMG_H = typeof customImgH === 'number' ? customImgH : 340;
    const HEADER_H = 370;
    const hasHeroImage = Boolean(imagemGerada);
    const TEXT_TOP = HEADER_H + (hasHeroImage ? IMG_H : 0);
    const TEXT_MAX_H = VTSD_MARGENS_A4.area_util.y_fim_px - TEXT_TOP;
    return (
      <div
        className="page-a4 relative overflow-hidden"
        style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_externo }}
      >
        {/* — Coluna esquerda: bloco teal com título — */}
        <div
          className="absolute flex flex-col z-[1]"
          style={{
            left: 0,
            top: 0,
            width: 370,
            height: HEADER_H,
            backgroundColor: blocoEscuro,
            padding: `${PG}px 40px 24px ${SIDE}px`,
            boxSizing: 'border-box',
          }}
        >
          <p className="font-display font-semibold text-[9px] leading-[13px] text-white m-0 tracking-[0.14em]">
            CAPÍTULO {capituloNumero}
          </p>
          <h1 className="font-sora font-bold text-[32px] leading-[35px] tracking-[-0.025em] text-white m-0 mt-3">
            {titulo || ''}
          </h1>
          {subtitulo && (
            <p className="font-display text-[16px] leading-[20px] mt-4 m-0" style={{ color: VTSD_COLOR.primary_light }}>
              {subtitulo}
            </p>
          )}
        </div>
        {/* — Coluna direita: fundo cinza claro — */}
        <div
          className="absolute z-0"
          style={{
            left: 370,
            top: 0,
            width: 225,
            height: HEADER_H,
            backgroundColor: VTSD_COLOR.fundo_externo,
          }}
        />
        {/* — Área de imagem: só ocupa espaço quando há imagem gerada — */}
        {hasHeroImage ? (
          <div
            className="absolute z-[1] overflow-hidden flex items-center justify-center"
            style={{
              left: 0,
              top: HEADER_H,
              width: 595,
              height: IMG_H,
              backgroundColor: VTSD_COLOR.fundo_box,
            }}
          >
            <img src={imagemGerada} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
        {/* — Texto corrido no rodapé — */}
        <div
          className="absolute z-[1] overflow-hidden"
          style={{
            left: SIDE,
            top: TEXT_TOP,
            width: AREA_W,
            maxHeight: TEXT_MAX_H,
            paddingTop: 16,
            boxSizing: 'border-box',
          }}
        >
          {limitParagraphs(filteredParagrafos, 220).slice(0, 2).map((p, i) => (
            <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_800 }}>
              {p}
            </p>
          ))}
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  /** Continuação de capítulo: header teal fino + corpo bem diagramado. Sem label "CONTINUAÇÃO". */
  if (layoutEfetivo === 'A4_2_continuacao') {
    const limitedParas = fitParasState[fitKey] ?? limitParagraphs(filteredParagrafos, 700);
    const { body, quote } = splitContinuationBodyQuote(limitedParas);
    return (
      <div
        className="page-a4 relative overflow-hidden flex flex-col"
        style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}
      >
        {/* Barra teal fina no topo — identidade visual do capítulo */}
        <div
          className="flex-shrink-0"
          style={{ width: 595, height: 6, backgroundColor: blocoMedio }}
          aria-hidden
        />
        {/* Corpo do texto com margens VTSD */}
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{
            padding: `30px ${SIDE}px ${PG}px ${SIDE}px`,
            boxSizing: 'border-box',
          }}
        >
          {body.map((p, i) => (
            <p
              key={i}
              className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto"
              style={{ color: VTSD_COLOR.texto_700 }}
            >
              {p}
            </p>
          ))}
          {quote ? (
            <blockquote
              className="font-display italic text-[13px] leading-[22px] m-0 my-4 py-3 px-5"
              style={{
                color: VTSD_COLOR.texto_700,
                borderLeft: `3px solid ${blocoMedio}`,
                backgroundColor: VTSD_COLOR.fundo_subtle,
                borderRadius: 4,
              }}
            >
              {quote}
            </blockquote>
          ) : null}
          {itens.length > 0 && (
            <VtsdNumberedSteps steps={itens} blocoMedio={blocoMedio} max={4} className="mt-2" />
          )}
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layoutEfetivo === 'A4_2_conteudo_misto') {
    const bodyParas = fitParasState[fitKey] ?? limitParagraphs(filteredParagrafos, 460);
    const calloutHtml = excerptDistinctFromSources(destaques[0], bodyParas);
    /** Texto da faixa superior: evita sumir com o layout quando o de-dup zera o trecho mas `destaques` existe. */
    const topBandBody = (calloutHtml || String(destaques?.[0] ?? '').trim()).trim();
    const pullQuote = excerptDistinctFromSources(citacao, [
      ...bodyParas,
      ...(topBandBody ? [topBandBody] : []),
    ]);
    const bottomText = excerptDistinctFromSources(destaques[1], [
      ...bodyParas,
      ...(topBandBody ? [topBandBody] : []),
      ...(pullQuote ? [pullQuote] : []),
    ]);
    const bottomBandBody = (bottomText || String(destaques?.[1] ?? '').trim()).trim();
    const sidebarW = 236;
    return (
      <div
        className="page-a4 relative overflow-hidden flex flex-row"
        style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}
      >
        <VtsdChapterSidebar
          widthPx={sidebarW}
          capituloNumero={capituloNumero}
          titulo={titulo || ''}
          subtitulo={subtitulo}
          nomeCurso={nomeCurso}
          blocoEscuro={blocoEscuro}
          blocoMedio={blocoMedio}
        />
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Dica do Autor — SÓ aparece se o conteúdo tem destaque real */}
        {topBandBody ? (
        <div
          className="w-full flex-shrink-0 flex flex-col gap-2.5"
          style={{
            backgroundColor: blocoEscuro,
            padding: `20px ${SIDE}px 20px 24px`,
            marginTop: PG,
          }}
        >
          <p className="font-display font-bold text-[10px] leading-[13px] text-white m-0">
            <span className="mr-1" aria-hidden>✦</span> Dica do Autor
          </p>
            <p className="font-display text-[13px] leading-[22px] text-white m-0 text-justify hyphens-auto">{topBandBody}</p>
        </div>
        ) : null}
        <div
          className="flex-1 min-h-0 overflow-hidden box-border"
          style={{ paddingLeft: 20, paddingRight: SIDE, paddingTop: 16, paddingBottom: 16 }}
        >
          {bodyParas.slice(0, 2).map((p, i) => (
            <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_700 }}>
              {p}
            </p>
          ))}
          {pullQuote ? (
            <blockquote
              className="font-display italic text-[13px] leading-[22px] m-0 mb-4 py-[15px] pr-5 pl-5 text-justify hyphens-auto"
              style={{
                color: VTSD_COLOR.texto_700,
                border: `1px solid ${VTSD_COLOR.texto_600}`,
                borderRadius: '0 15px 15px 0',
              }}
            >
              {pullQuote}
            </blockquote>
          ) : null}
          <div className={`flex gap-3 mt-2 ${imagemGerada ? 'items-start' : 'flex-col'}`}>
            <div className={imagemGerada ? 'flex-1 min-w-0' : 'w-full'}>
              {bodyParas.slice(2).map((p, i) => (
                <p key={i} className="font-display italic text-[13px] leading-[22px] mb-2 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_800 }}>
                  {p}
                </p>
              ))}
            </div>
            {imagemGerada ? (
              <div
                className="flex-shrink-0 rounded-sm flex items-center justify-center overflow-hidden"
                style={{
                  width: typeof customImgW === 'number' ? customImgW : 180,
                  height: typeof customImgH === 'number' ? customImgH : 140,
                  backgroundColor: VTSD_COLOR.fundo_box,
                }}
              >
                <img src={imagemGerada} alt="" className="w-full h-full object-cover" />
              </div>
            ) : null}
          </div>
        </div>
        {/* Exercício Prático — SÓ aparece se o conteúdo tem segundo destaque real */}
        {bottomBandBody ? (
        <div
          className="w-full flex-shrink-0 flex flex-col gap-2.5"
          style={{
            backgroundColor: blocoEscuro,
            padding: `15px ${SIDE}px 15px 24px`,
            marginBottom: VTSD_MARGENS_A4.margens.base_px,
          }}
        >
          <p className="font-sora font-bold text-[12px] leading-[13px] m-0" style={{ color: VTSD_COLOR.primary_light }}>
            Exercício Prático
          </p>
            <p className="font-display text-[13px] leading-[22px] text-white m-0 mt-1 text-justify hyphens-auto">{bottomBandBody}</p>
        </div>
        ) : null}
        {extraContentBlocks.length > 0 ? (
          <div
            className="w-full flex-shrink-0 py-3 overflow-x-auto box-border"
            style={{
              borderTop: `1px solid ${VTSD_COLOR.texto_600}`,
              paddingLeft: 20,
              paddingRight: SIDE,
            }}
          >
            <ContentBlocksRenderer blocks={extraContentBlocks} />
          </div>
        ) : null}
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layoutEfetivo === 'A4_7_sidebar_conteudo') {
    const limitedParasSidebar = fitParasState[fitKey] ?? limitParagraphs(filteredParagrafos, 460);
    const sidebarW = 225;
    const steps = itens.slice(0, 4);
    const citacaoBloco = excerptDistinctFromSources(citacao, [...limitedParasSidebar, ...steps]);
    return (
      <div className="page-a4 relative flex flex-col overflow-hidden" style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}>
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <VtsdChapterSidebar
            widthPx={sidebarW}
            capituloNumero={capituloNumero}
            titulo={titulo || ''}
            subtitulo={subtitulo}
            nomeCurso={nomeCurso}
            blocoEscuro={blocoEscuro}
            blocoMedio={blocoMedio}
          />
          <div
            className="flex-1 min-w-0 min-h-0 overflow-hidden"
            style={{
              paddingTop: PG,
              paddingBottom: PG,
              paddingLeft: 20,
              paddingRight: SIDE,
              boxSizing: 'border-box',
            }}
          >
            {limitedParasSidebar.map((p, i) => (
              <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_700 }}>
                {p}
              </p>
            ))}
            {citacaoBloco ? (
              <blockquote
                className="font-display italic text-[13px] leading-[22px] m-0 my-4 py-3 px-5 text-justify hyphens-auto"
                style={{
                  color: VTSD_COLOR.texto_700,
                  borderLeft: `3px solid ${blocoMedio}`,
                  backgroundColor: VTSD_COLOR.fundo_subtle,
                  borderRadius: 4,
                }}
              >
                {truncateAtSentence(citacaoBloco, 260)}
              </blockquote>
            ) : null}
            {steps.length > 0 ? (
              <VtsdNumberedSteps steps={steps} blocoMedio={blocoMedio} max={4} className="mt-2" />
            ) : null}
          </div>
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layoutEfetivo === 'A4_3_sidebar_steps') {
    const steps = (itens.length ? itens : destaques.length ? destaques : filteredParagrafos.slice(0, 4)).slice(0, 4);
    const limitedParasSteps = limitParagraphs(filteredParagrafos, 300);
    const citacaoBloco = excerptDistinctFromSources(citacao, limitedParasSteps);
    return (
      <div className="page-a4 relative overflow-hidden flex" style={{ width: 595, height: 842 }}>
        <VtsdChapterSidebar
          widthPx={370}
          capituloNumero={capituloNumero}
          titulo={titulo || ''}
          subtitulo={subtitulo}
          nomeCurso={nomeCurso}
          blocoEscuro={blocoEscuro}
          blocoMedio={blocoMedio}
        />
        <div
          className="flex-1 flex flex-col min-w-0 h-full overflow-hidden box-border"
          style={{
            backgroundColor: VTSD_COLOR.fundo_externo,
            padding: `${PG}px ${SIDE}px 40px 20px`,
            boxSizing: 'border-box',
          }}
        >
          {limitedParasSteps.slice(0, 2).map((p, i) => (
            <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_700 }}>
              {p}
            </p>
          ))}
          {citacaoBloco ? (
            <blockquote
              className="font-display italic text-[13px] leading-[22px] m-0 mb-4 py-[15px] px-5 text-justify hyphens-auto"
              style={{
                color: VTSD_COLOR.texto_700,
                border: `1px solid ${VTSD_COLOR.texto_600}`,
                borderRadius: '0 15px 15px 0',
              }}
            >
              {truncateAtSentence(citacaoBloco, 200)}
            </blockquote>
          ) : null}
          <VtsdNumberedSteps steps={steps} blocoMedio={blocoMedio} className="flex-1" />
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layoutEfetivo === 'A4_4_magazine') {
    const limitedParasMag = limitParagraphs(filteredParagrafos, 380);
    const insightRodape = excerptDistinctFromSources(citacao, limitedParasMag);
    return (
      <div
        className="page-a4 relative overflow-hidden flex flex-col"
        style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}
      >
        {/* Título no topo — flow, não absoluto */}
        <div className="flex-shrink-0" style={{ padding: `${PG}px ${SIDE}px 16px ${SIDE}px` }}>
          <h2
            className="font-sora font-bold text-[32px] leading-[35px] m-0"
            style={{ color: blocoMedio }}
          >
            {titulo || ''}
          </h2>
        </div>

        {/* Corpo principal: imagem + texto lado a lado (flow-based) */}
        {imagemGerada ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Coluna da imagem: fundo escuro + imagem */}
            <div className="relative flex-shrink-0" style={{ width: typeof customImgW === 'number' ? customImgW : 308 }}>
              <div
                className="absolute inset-0"
                style={{ backgroundColor: blocoEscuro, left: 0, right: 4 }}
                aria-hidden
              />
              <div
                className="relative w-full h-full flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: VTSD_COLOR.fundo_box }}
              >
                <img src={imagemGerada} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
            {/* Coluna de texto: flow natural */}
            <div
              className="flex-1 min-w-0 overflow-hidden box-border"
              style={{ padding: `0 ${SIDE}px 16px 16px` }}
            >
              <h3 className="font-display font-semibold text-[16px] leading-[21px] m-0 mb-3" style={{ color: blocoMedio }}>
                {subtitulo || 'Destaque'}
              </h3>
              {limitedParasMag.map((p, i) => (
                <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_700 }}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: `0 ${SIDE}px 16px ${SIDE}px` }}>
            <h3 className="font-display font-semibold text-[16px] leading-[21px] m-0 mb-3" style={{ color: blocoMedio }}>
              {subtitulo || 'Destaque'}
            </h3>
            {limitedParasMag.map((p, i) => (
              <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_700 }}>
                {p}
              </p>
            ))}
          </div>
        )}
        {/* Conceito-Chave no rodapé (flow, não absoluto) */}
        {insightRodape ? (
          <div
            className="flex-shrink-0 flex flex-col gap-2.5"
            style={{
              backgroundColor: blocoEscuro,
              padding: '20px 50px 16px 50px',
              marginBottom: VTSD_MARGENS_A4.margens.base_px,
            }}
          >
            <p className="font-sora font-bold text-[12px] leading-[13px] m-0" style={{ color: VTSD_COLOR.primary_light }}>
              ✦ Conceito-Chave
            </p>
            <p className="font-display text-[13px] leading-[22px] text-white m-0 mt-1 text-justify hyphens-auto">
              {truncateAtSentence(insightRodape, 200)}
            </p>
          </div>
        ) : null}
        {extraContentBlocks.length > 0 ? (
          <div
            className="flex-shrink-0 overflow-x-auto py-2"
            style={{
              paddingLeft: SIDE,
              paddingRight: SIDE,
              maxHeight: 140,
            }}
          >
            <ContentBlocksRenderer blocks={extraContentBlocks} />
          </div>
        ) : null}
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  // ——— Layouts legados ———

  /** Rodapé comum a todos os layouts — sem borda/linha divisória */
  const Rodape = () => (
    <footer
      className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs"
      style={{
        color: `${cor_texto_principal}80`,
      }}
    >
      <span>{nomeCurso}</span>
      <span>Página {numeroPagina}</span>
    </footer>
  );

  // --- Limitar parágrafos para layouts legados ---
  const legacyParas = limitParagraphs(filteredParagrafos, 500);

  // header_destaque: header em cor primária (texto claro), fundo claro, texto escuro, faixa chevron opcional
  if (layoutEfetivo === 'header_destaque') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <header
          className="px-8 py-6 text-white font-sora font-bold"
          style={{ backgroundColor: tema.primary, color: '#fff' }}
        >
          <h2 className="text-xl md:text-2xl uppercase tracking-wide">{titulo || ''}</h2>
        </header>
        <div className="flex-1 px-8 py-6 pb-4 overflow-hidden min-h-0">
          {legacyParas.map((p, i) => (
            <p key={i} className="mb-4 text-sm leading-relaxed text-justify hyphens-auto" style={{ color: cor_texto_principal }}>
              {p}
            </p>
          ))}
        </div>
        {usar_faixa_decorativa && (
          <FaixaChevron cor={tema.accent || tema.primary} />
        )}
        <Rodape />
      </div>
    );
  }

  // dois_colunas: conteúdo à esquerda; à direita: barra lateral colorida (opcional) ou destaques/fluxograma/tabela
  if (layoutEfetivo === 'dois_colunas') {
    const proporcaoBarraLateral = usar_barra_lateral ? { left: 'w-[70%]', right: 'w-[30%]' } : proporcao;
    const rightContent = usar_barra_lateral ? (
      <div
        className="h-full flex items-center justify-center py-8"
        style={{ backgroundColor: tema.primary, color: '#fff' }}
      >
        <span
          className="font-sora font-bold text-sm uppercase tracking-[0.3em] whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {titulo || ''}
        </span>
      </div>
    ) : sugestao_fluxograma?.etapas?.length ? (
      <div className="relative pl-2">
        {sugestao_fluxograma.titulo && (
          <h3 className="font-sora font-semibold text-sm mb-3" style={{ color: cor_texto_destaque }}>
            {sugestao_fluxograma.titulo}
          </h3>
        )}
        <div className="relative border-l-2 border-dashed pl-4 space-y-3" style={{ borderColor: tema.primary }}>
          {sugestao_fluxograma.etapas.map((etapa, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white -ml-[1.4rem]"
                style={{ backgroundColor: tema.primary }}
              >
                {i + 1}
              </span>
              <span className="text-sm py-1.5 px-3 rounded-lg flex-1" style={{ backgroundColor: cor_fundo_destaque, color: cor_texto_destaque }}>
                {etapa}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : sugestao_tabela?.colunas?.length ? (
      <div className="overflow-x-auto">
        {sugestao_tabela.titulo && (
          <h3 className="font-sora font-semibold text-sm mb-2" style={{ color: cor_texto_destaque }}>
            {sugestao_tabela.titulo}
          </h3>
        )}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ backgroundColor: tema.primary, color: '#fff' }}>
              {sugestao_tabela.colunas.map((c, i) => (
                <th key={i} className="px-2 py-2 text-left font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sugestao_tabela.linhas || []).map((linha, ri) => (
              <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? cor_fundo_destaque : 'transparent', color: cor_texto_principal }}>
                {linha.map((cel, ci) => (
                  <td key={ci} className="px-2 py-1.5 border-b border-black/10">{cel}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      destaques.map((d, i) => (
        <div
          key={i}
          className="p-4 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: cor_fundo_destaque,
            color: cor_texto_destaque,
          }}
        >
          {d}
        </div>
      ))
    );

    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div className="flex flex-1 min-h-0 pb-16">
          <div className={`${proporcaoBarraLateral.left} px-8 py-6 overflow-auto`}>
            {titulo && (
              <h2 className="font-sora font-bold text-lg mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
                {titulo}
              </h2>
            )}
            {legacyParas.map((p, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed text-justify hyphens-auto" style={{ color: cor_texto_principal }}>
                {p}
              </p>
            ))}
          </div>
          <div className={`${proporcaoBarraLateral.right} p-4 flex flex-col gap-3 overflow-auto`}>
            {rightContent}
          </div>
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // dados_grafico: página com gráfico sugerido pela IA (barras, pizza ou linha)
  if (layoutEfetivo === 'dados_grafico' && sugestao_grafico?.labels?.length && sugestao_grafico?.valores?.length) {
    const maxVal = Math.max(...sugestao_grafico.valores, 1);
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div className="flex-1 px-8 py-6 pb-20 overflow-hidden min-h-0">
          {titulo && (
            <h2 className="font-sora font-bold text-lg mb-2" style={{ color: cor_texto_destaque }}>
              {titulo}
            </h2>
          )}
          {sugestao_grafico.titulo && (
            <p className="text-sm mb-4 opacity-90">{sugestao_grafico.titulo}</p>
          )}
          {filteredParagrafos.length > 0 && (
            <p className="text-sm mb-6 leading-relaxed text-justify hyphens-auto" style={{ color: cor_texto_principal }}>
              {truncateAtSentence(filteredParagrafos[0], 300)}
            </p>
          )}
          <div className="mt-6">
            {sugestao_grafico.tipo === 'barra' && (
              <div className="space-y-3">
                {sugestao_grafico.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-32 flex-shrink-0 text-sm" style={{ color: cor_texto_principal }}>{label}</span>
                    <div className="flex-1 h-8 rounded overflow-hidden bg-black/10">
                      <div
                        className="h-full rounded transition-all min-w-[2rem] flex items-center justify-end pr-2 text-xs font-bold text-white"
                        style={{
                          width: `${(sugestao_grafico.valores[i] ?? 0) / maxVal * 100}%`,
                          backgroundColor: tema.accent || tema.primary,
                        }}
                      >
                        {sugestao_grafico.valores[i]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sugestao_grafico.tipo === 'pizza' && (
              <div className="flex flex-wrap gap-4 items-center">
                {sugestao_grafico.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: [tema.primary, tema.accent, tema.primaryLight].filter(Boolean)[i % 3] || tema.primary }}
                    />
                    <span className="text-sm">{label}: {sugestao_grafico.valores[i]}</span>
                  </div>
                ))}
              </div>
            )}
            {sugestao_grafico.tipo === 'linha' && (
              <div className="space-y-2">
                {sugestao_grafico.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-24 flex-shrink-0">{label}</span>
                    <span className="font-semibold" style={{ color: tema.primary }}>{sugestao_grafico.valores[i]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <Rodape />
      </div>
    );
  }

  // imagem_lateral: duas colunas só quando há imagem; senão texto em largura total
  if (layoutEfetivo === 'imagem_lateral') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div className="flex flex-1 min-h-0 pb-16">
          <div className={`${imagemGerada ? 'w-[55%]' : 'w-full'} px-8 py-6 overflow-auto`}>
            {titulo && (
              <h2 className="font-sora font-bold text-lg mb-4" style={{ color: cor_texto_destaque }}>
                {titulo}
              </h2>
            )}
            {legacyParas.map((p, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed text-justify hyphens-auto" style={{ color: cor_texto_principal }}>
                {p}
              </p>
            ))}
          </div>
          {imagemGerada ? (
            <div className="w-[50%] p-4 flex items-center justify-center overflow-hidden rounded-sm">
              <img
                src={imagemGerada}
                alt=""
                className="w-full h-full min-h-[340px] object-cover rounded-sm"
              />
            </div>
          ) : null}
        </div>
        <Rodape />
      </div>
    );
  }

  // citacao_grande: fundo em cor do curso, citação em branco (contraste)
  if (layoutEfetivo === 'citacao_grande') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: tema.primary,
          color: '#fff',
        }}
      >
        <div className="flex-1 flex items-center justify-center px-12 pb-20">
          <blockquote
            className="text-center text-2xl md:text-3xl font-sora font-medium leading-relaxed max-w-2xl text-white"
            style={{ color: '#fff' }}
          >
            &ldquo;{citacao || titulo || ''}&rdquo;
          </blockquote>
        </div>
        <div className="h-1 w-full opacity-80" style={{ backgroundColor: tema.accent || '#fff' }} />
        <footer
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs text-white/70"
        >
          <span>{nomeCurso}</span>
          <span>Página {numeroPagina}</span>
        </footer>
      </div>
    );
  }

  // lista_icones: blocos com ícones em cor do curso (texto contrastante)
  if (layoutEfetivo === 'lista_icones') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        {titulo && (
          <header className="px-8 pt-6">
            <h2 className="font-sora font-bold text-lg uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
              {titulo}
            </h2>
          </header>
        )}
        <div className="flex-1 grid grid-cols-2 gap-6 p-8 pb-20">
          {(itens.length ? itens : destaques.length ? destaques : filteredParagrafos).slice(0, 6).map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                backgroundColor: cor_fundo_destaque,
                color: cor_texto_destaque,
              }}
            >
              <span
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white"
                style={{ backgroundColor: tema.primary }}
              >
                {i + 1}
              </span>
              <span className="text-sm font-medium leading-snug">{item}</span>
            </div>
          ))}
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // imagem_top: área de imagem no topo, título, texto justificado, faixa decorativa
  if (layoutEfetivo === 'imagem_top') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        {imagemGerada ? (
          <div
            className="w-full h-80 flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: tema.primaryDark || tema.primary }}
          >
            <img src={imagemGerada} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
        <div className="flex-1 px-8 py-6 pb-4 overflow-hidden min-h-0">
          {titulo && (
            <h2 className="font-sora font-bold text-xl mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
              {titulo}
            </h2>
          )}
          {legacyParas.map((p, i) => (
            <p key={i} className="mb-3 text-sm leading-relaxed text-justify hyphens-auto" style={{ color: cor_texto_principal }}>
              {p}
            </p>
          ))}
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // Fallback VTSD: header teal + corpo com margens corretas + badge
  // Garante que NENHUMA página fique sem design visual
  const fallbackBodyParas = limitParagraphs(filteredParagrafos.length > 0 ? filteredParagrafos : [], 500);
  const fallbackCallout = destaques.length > 0 ? destaques[0] : '';
  return (
    <div
      className="page-a4 relative flex flex-col overflow-hidden"
      style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}
    >
      {/* Header teal com título */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundColor: blocoEscuro,
          padding: `${PG}px ${SIDE}px 24px ${SIDE}px`,
          boxSizing: 'border-box',
        }}
      >
        <p className="font-display font-semibold text-[11px] leading-[16px] text-white/70 m-0 tracking-[0.1em]">
          CAPÍTULO {capituloNumero}
        </p>
        <h1
          className="font-sora font-bold text-[32px] leading-[35px] tracking-[-0.025em] text-white m-0 mt-2 hyphens-auto break-words"
        >
          {titulo || ''}
        </h1>
        {subtitulo && (
          <p className="font-display text-[13px] leading-[22px] mt-2 m-0" style={{ color: VTSD_COLOR.primary_light }}>
            {subtitulo}
          </p>
        )}
      </div>

      {/* Corpo com margens VTSD */}
      <div
        className="flex-1 min-h-0 overflow-hidden"
        style={{
          padding: `20px ${SIDE}px`,
          boxSizing: 'border-box',
        }}
      >
        {fallbackBodyParas.map((p, i) => (
          <p key={i} className="font-display text-[13px] leading-[22px] mb-3 m-0 text-justify hyphens-auto" style={{ color: VTSD_COLOR.texto_700 }}>
            {p}
          </p>
        ))}
        {citacao && (
          <blockquote
            className="font-display italic text-[13px] leading-[22px] m-0 my-3 py-3 px-5"
            style={{
              color: VTSD_COLOR.texto_700,
              borderLeft: `3px solid ${blocoMedio}`,
              backgroundColor: VTSD_COLOR.fundo_subtle,
              borderRadius: 4,
            }}
          >
            {citacao}
          </blockquote>
        )}
        {itens.length > 0 && (
          <VtsdNumberedSteps steps={itens} blocoMedio={blocoMedio} max={4} className="mt-3" />
        )}
      </div>

      {/* Callout no rodapé (se tiver destaque) */}
      {fallbackCallout && (
        <div
          className="flex-shrink-0"
          style={{
            backgroundColor: blocoEscuro,
            padding: `15px ${SIDE}px`,
            boxSizing: 'border-box',
          }}
        >
          <p className="font-display text-[13px] leading-[22px] text-white m-0 text-justify hyphens-auto">
            {fallbackCallout}
          </p>
        </div>
      )}

      <BadgePagina numero={numeroPagina} bg={blocoMedio} />
    </div>
  );
}
