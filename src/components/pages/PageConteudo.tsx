'use client';

import { ContentBlocksRenderer, type ContentBlockItem } from '@/components/ContentBlocksRenderer';
import type { LayoutTipo } from '@/lib/design-agent';
import { excerptDistinctFromSources } from '@/lib/dedupe-vtt-excerpts';
import { isRenderableImageUrl } from '@/lib/image-url';
import { VTSD_COLOR, VTSD_MARGENS_A4 } from '@/lib/vtsd-design-system';

const PG = VTSD_MARGENS_A4.margens.topo_px;
const SIDE = VTSD_MARGENS_A4.margens.lateral_px;
const AREA_W = VTSD_MARGENS_A4.area_util.largura_px;

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

/** Descrição / prompt no slot de imagem quando ainda não há `imagem_url` gerada. */
function ImageAreaPlaceholder({
  sugestao,
  prompt,
  fallback,
  className,
}: {
  sugestao?: string;
  prompt?: string;
  fallback: string;
  className?: string;
}) {
  const text = [sugestao?.trim(), prompt?.trim()].filter(Boolean).join('\n\n') || fallback;
  return (
    <div className="w-full h-full min-h-[48px] px-3 py-2 overflow-y-auto flex items-center justify-center box-border">
      <p
        className={
          className ??
          'text-[#575757] font-display text-[11px] leading-relaxed text-center whitespace-pre-wrap max-h-full'
        }
      >
        {text}
      </p>
    </div>
  );
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

/** Badge de numeração — fora da área útil (y=812), Book DS */
function BadgePagina({ numero, bg = VTSD_COLOR.primary_dark }: { numero: number; bg?: string }) {
  const b = VTSD_MARGENS_A4.badge_pagina;
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
}: PageConteudoProps) {
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
  } = pagina;

  const imagemGerada = isRenderableImageUrl(imagemUrlPagina) ? imagemUrlPagina.trim() : undefined;

  const proporcao = getProporcaoClasses(pagina.proporcao_colunas);
  const blocoEscuro = tema.primaryDark || VTSD_COLOR.primary_darker;
  const blocoMedio = tema.primary || VTSD_COLOR.primary_dark;
  const cyanMarca = tema.primaryLight || VTSD_COLOR.primary;

  // ——— Layouts A4 design system VTSD (Figma) ———
  if (layout_tipo === 'A4_1_abertura') {
    // Figma A4-1: split horizontal no topo (esquerda teal 370px / direita cinza 225px),
    // imagem full-width abaixo do split, texto corrido no rodapé.
    const IMG_H = 220;
    const HEADER_H = 370;
    const TEXT_TOP = HEADER_H + IMG_H;
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
          <h1 className="font-sora font-bold text-[40px] leading-[48px] tracking-[-0.025em] text-white m-0">
            {titulo || 'Capítulo'}
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
        {/* — Área de imagem: full-width abaixo do split — */}
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
          {imagemGerada ? (
            <img src={imagemGerada} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageAreaPlaceholder
              sugestao={sugestao_imagem}
              prompt={prompt_imagem}
              fallback="Área de imagem"
              className="text-[#A8A8A8] font-display text-xs text-center whitespace-pre-wrap max-h-full px-3"
            />
          )}
        </div>
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
          {paragrafos.slice(0, 3).map((p, i) => (
            <p key={i} className="font-display text-[14px] leading-[15px] mb-3 m-0 text-justify" style={{ color: VTSD_COLOR.texto_800 }}>
              {p}
            </p>
          ))}
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layout_tipo === 'A4_2_conteudo_misto') {
    const bodyParas = paragrafos;
    const calloutHtml = excerptDistinctFromSources(destaques[0], bodyParas);
    const pullQuote = excerptDistinctFromSources(citacao, [
      ...bodyParas,
      ...(calloutHtml ? [calloutHtml] : []),
    ]);
    const bottomText = excerptDistinctFromSources(destaques[1], [
      ...bodyParas,
      ...(calloutHtml ? [calloutHtml] : []),
      ...(pullQuote ? [pullQuote] : []),
    ]);
    return (
      <div
        className="page-a4 relative overflow-hidden flex flex-col"
        style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}
      >
        {calloutHtml ? (
          <div
            className="w-full flex-shrink-0 flex flex-col gap-2.5"
            style={{
              backgroundColor: blocoEscuro,
              padding: '20px 50px',
              marginTop: PG,
            }}
          >
            <p className="font-display font-bold text-[10px] leading-[13px] text-white m-0">
              <span className="mr-1" aria-hidden>✦</span> Dica do Autor
            </p>
            <p className="font-display text-[14px] leading-[15px] text-white m-0">{calloutHtml}</p>
          </div>
        ) : (
          <div className="flex-shrink-0" style={{ height: PG }} aria-hidden />
        )}
        <div className="px-[50px] py-5 flex-1 min-h-0 overflow-hidden">
          {bodyParas.slice(0, 2).map((p, i) => (
            <p key={i} className="font-display text-[14px] leading-[15px] mb-3 m-0" style={{ color: VTSD_COLOR.texto_700 }}>
              {p}
            </p>
          ))}
          {pullQuote ? (
            <blockquote
              className="font-display italic text-[14px] leading-[15px] m-0 mb-4 py-[15px] pr-5 pl-5"
              style={{
                color: VTSD_COLOR.texto_700,
                border: `1px solid ${VTSD_COLOR.texto_600}`,
                borderRadius: '0 15px 15px 0',
              }}
            >
              {pullQuote}
            </blockquote>
          ) : null}
          <div className="flex gap-0 mt-2">
            <div className="w-[240px] flex-shrink-0 pr-2">
              {bodyParas.slice(2, 4).map((p, i) => (
                <p key={i} className="font-display italic text-[14px] leading-[15px] mb-2 m-0" style={{ color: VTSD_COLOR.texto_800 }}>
                  {p}
                </p>
              ))}
            </div>
            <div
              className="flex-1 min-h-[120px] rounded-sm flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: VTSD_COLOR.fundo_box }}
            >
              {imagemGerada ? (
                <img src={imagemGerada} alt="" className="w-full h-full min-h-[120px] object-cover" />
              ) : (
                <ImageAreaPlaceholder
                  sugestao={sugestao_imagem}
                  prompt={prompt_imagem}
                  fallback="Imagem lateral"
                />
              )}
            </div>
          </div>
        </div>
        {bottomText ? (
          <div
            className="w-full flex-shrink-0 flex flex-col gap-2.5"
            style={{
              backgroundColor: blocoEscuro,
              padding: '15px 50px',
              marginBottom: VTSD_MARGENS_A4.margens.base_px,
            }}
          >
            <p className="font-sora font-bold text-[12px] leading-[13px] m-0" style={{ color: VTSD_COLOR.primary_light }}>
              Exercício Prático
            </p>
            <p className="font-display text-[14px] leading-[15px] text-white m-0 mt-1">{bottomText}</p>
          </div>
        ) : (
          <div className="flex-shrink-0" style={{ marginBottom: VTSD_MARGENS_A4.margens.base_px }} aria-hidden />
        )}
        {extraContentBlocks.length > 0 ? (
          <div
            className="w-full flex-shrink-0 px-[50px] py-3 overflow-x-auto"
            style={{ borderTop: `1px solid ${VTSD_COLOR.texto_600}` }}
          >
            <ContentBlocksRenderer blocks={extraContentBlocks} />
          </div>
        ) : null}
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layout_tipo === 'A4_3_sidebar_steps') {
    const steps = itens.length ? itens : destaques.length ? destaques : paragrafos.slice(0, 4);
    const citacaoBloco = excerptDistinctFromSources(citacao, paragrafos);
    return (
      <div className="page-a4 relative overflow-hidden flex" style={{ width: 595, height: 842 }}>
        <aside
          className="flex flex-col justify-between flex-shrink-0 h-full"
          style={{
            width: 370,
            backgroundColor: blocoEscuro,
            padding: '50px 40px 20px 50px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <p className="font-display font-semibold text-[9px] leading-[13px] text-white m-0 uppercase tracking-wide">
              {nomeCurso}
            </p>
            <h1 className="font-sora font-bold text-[40px] leading-[48px] tracking-[-0.025em] text-white m-0 mt-4">
              {titulo || 'Conteúdo'}
            </h1>
            {subtitulo && (
              <p className="font-display text-[17px] leading-[20px] mt-3 m-0" style={{ color: VTSD_COLOR.teal_tint }}>
                {subtitulo}
              </p>
            )}
          </div>
          <div className="relative">
            <span
              className="font-sora font-bold text-[110px] leading-[120px] tracking-[-0.04em] block select-none"
              style={{ color: VTSD_COLOR.primary }}
              aria-hidden
            >
              {String(numeroPagina).padStart(2, '0')}
            </span>
            <p className="font-display font-semibold text-[9px] leading-[13px] text-white/50 m-0 mt-1">{nomeCurso}</p>
          </div>
        </aside>
        <div
          className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
          style={{ backgroundColor: VTSD_COLOR.fundo_externo, padding: `${PG}px 20px 40px 20px`, boxSizing: 'border-box' }}
        >
          {paragrafos.slice(0, 2).map((p, i) => (
            <p key={i} className="font-display text-[14px] leading-[15px] mb-3 m-0" style={{ color: VTSD_COLOR.texto_700 }}>
              {p}
            </p>
          ))}
          {citacaoBloco ? (
            <blockquote
              className="font-display italic text-[14px] leading-[15px] m-0 mb-4 py-[15px] px-5"
              style={{
                color: VTSD_COLOR.texto_700,
                border: `1px solid ${VTSD_COLOR.texto_600}`,
                borderRadius: '0 15px 15px 0',
              }}
            >
              {citacaoBloco}
            </blockquote>
          ) : null}
          <div className="space-y-2.5 mt-2 flex-1">
            {steps.slice(0, 4).map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-sora font-bold text-[13px] text-white"
                  style={{ backgroundColor: blocoMedio }}
                >
                  {i + 1}
                </span>
                <p className="font-display text-[14px] leading-[15px] m-0 pt-1.5" style={{ color: VTSD_COLOR.texto_800 }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  if (layout_tipo === 'A4_4_magazine') {
    const insightRodape = excerptDistinctFromSources(citacao, paragrafos);
    return (
      <div
        className="page-a4 relative overflow-hidden"
        style={{ width: 595, height: 842, backgroundColor: VTSD_COLOR.fundo_page }}
      >
        <h2
          className="font-sora font-bold text-[28px] leading-[40px] m-0 absolute w-[495px]"
          style={{ left: SIDE, top: PG, color: blocoMedio }}
        >
          {titulo || 'Seção'}
        </h2>
        <div
          className="absolute left-0 top-[176px] w-[304px] h-[382px] z-0"
          style={{ backgroundColor: blocoEscuro }}
          aria-hidden
        />
        <div
          className="absolute left-0 top-[207px] w-[308px] h-[316px] z-[1] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: VTSD_COLOR.fundo_box }}
        >
          {imagemGerada ? (
            <img src={imagemGerada} alt="" className="w-full h-full object-cover z-[1]" />
          ) : (
            <ImageAreaPlaceholder
              sugestao={sugestao_imagem}
              prompt={prompt_imagem}
              fallback="Foto"
              className="text-[#A8A8A8] font-display text-[11px] px-4 text-center whitespace-pre-wrap max-h-full z-[1]"
            />
          )}
        </div>
        <div className="absolute left-[307px] top-[176px] w-[240px] z-[1]">
          <h3 className="font-display font-semibold text-[20px] leading-[24px] m-0 mb-3" style={{ color: blocoMedio }}>
            {subtitulo || 'Destaque'}
          </h3>
          {paragrafos.map((p, i) => (
            <p key={i} className="font-display text-[14px] leading-[15px] mb-3 m-0" style={{ color: VTSD_COLOR.texto_700 }}>
              {p}
            </p>
          ))}
        </div>
        {insightRodape ? (
          <div
            className="absolute left-0 w-full z-[1] flex flex-col gap-2.5"
            style={{
              bottom: VTSD_MARGENS_A4.margens.base_px,
              backgroundColor: blocoEscuro,
              padding: '20px 50px 16px 50px',
            }}
          >
            <p className="font-sora font-bold text-[12px] leading-[13px] m-0" style={{ color: VTSD_COLOR.primary_light }}>
              ✦ Conceito-Chave
            </p>
            <p className="font-display text-[14px] leading-[15px] text-white m-0 mt-1">{insightRodape}</p>
          </div>
        ) : null}
        {extraContentBlocks.length > 0 ? (
          <div
            className="absolute z-[2] w-[495px] overflow-x-auto py-2"
            style={{
              left: SIDE,
              bottom: VTSD_MARGENS_A4.margens.base_px + 36,
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

  if (layout_tipo === 'A4_7_sidebar_conteudo') {
    return (
      <div className="page-a4 relative overflow-hidden flex" style={{ width: 595, height: 842 }}>
        <aside
          className="flex flex-col justify-between flex-shrink-0 min-w-0"
          style={{
            width: 242,
            height: '100%',
            backgroundColor: blocoEscuro,
            padding: '50px 26px 20px 26px',
            boxSizing: 'border-box',
          }}
        >
          <div className="min-w-0 w-full">
            <p className="font-display font-semibold text-[9px] text-white/80 m-0">{nomeCurso}</p>
            <h1
              lang="pt-BR"
              className="font-sora font-bold text-white m-0 mt-4 max-w-full text-[26px] leading-snug hyphens-auto break-words [overflow-wrap:anywhere]"
            >
              {titulo || 'Módulo'}
            </h1>
          </div>
          <p className="font-display text-[9px] text-white/50 m-0">{nomeCurso}</p>
        </aside>
        <div
          className="flex-1 overflow-auto"
          style={{
            backgroundColor: VTSD_COLOR.fundo_box,
            padding: '24px 40px 40px 32px',
            boxSizing: 'border-box',
          }}
        >
          {paragrafos.map((p, i) => (
            <p key={i} className="font-display text-[14px] leading-[15px] mb-3 m-0" style={{ color: VTSD_COLOR.texto_800 }}>
              {p}
            </p>
          ))}
        </div>
        <BadgePagina numero={numeroPagina} bg={blocoMedio} />
      </div>
    );
  }

  // ——— Layouts legados ———

  /** Rodapé comum a todos os layouts */
  const Rodape = () => (
    <footer
      className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs border-t"
      style={{
        color: cor_texto_principal,
        borderColor: `${cor_texto_principal}30`,
      }}
    >
      <span>{nomeCurso}</span>
      <span>Página {numeroPagina}</span>
    </footer>
  );

  // header_destaque: header em cor primária (texto claro), fundo claro, texto escuro, faixa chevron opcional
  if (layout_tipo === 'header_destaque') {
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
          <h2 className="text-xl md:text-2xl uppercase tracking-wide">{titulo || 'Conteúdo'}</h2>
        </header>
        <div className="flex-1 px-8 py-6 pb-4">
          {paragrafos.map((p, i) => (
            <p key={i} className="mb-4 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
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
  if (layout_tipo === 'dois_colunas') {
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
          {titulo || 'Conteúdo'}
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
            {paragrafos.map((p, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
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
  if (layout_tipo === 'dados_grafico' && sugestao_grafico?.labels?.length && sugestao_grafico?.valores?.length) {
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
        <div className="flex-1 px-8 py-6 pb-20">
          {titulo && (
            <h2 className="font-sora font-bold text-lg mb-2" style={{ color: cor_texto_destaque }}>
              {titulo}
            </h2>
          )}
          {sugestao_grafico.titulo && (
            <p className="text-sm mb-4 opacity-90">{sugestao_grafico.titulo}</p>
          )}
          {paragrafos.length > 0 && (
            <p className="text-sm mb-6 leading-relaxed" style={{ color: cor_texto_principal }}>
              {paragrafos[0]}
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

  // imagem_lateral: texto à esquerda, área de imagem (sugestão) à direita
  if (layout_tipo === 'imagem_lateral') {
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
          <div className="w-[55%] px-8 py-6 overflow-auto">
            {titulo && (
              <h2 className="font-sora font-bold text-lg mb-4" style={{ color: cor_texto_destaque }}>
                {titulo}
              </h2>
            )}
            {paragrafos.map((p, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed" style={{ color: cor_texto_principal }}>
                {p}
              </p>
            ))}
          </div>
          <div className="w-[45%] p-6 flex items-center justify-center">
            {imagemGerada ? (
              <img
                src={imagemGerada}
                alt=""
                className="w-full aspect-square max-h-72 rounded-xl object-cover"
              />
            ) : (
              <div
                className="w-full aspect-square max-h-72 rounded-xl border-2 border-dashed flex flex-col items-stretch justify-center text-center p-4 min-h-0"
                style={{
                  borderColor: `${cor_texto_principal}40`,
                  color: cor_texto_principal,
                  backgroundColor: cor_fundo_destaque,
                }}
              >
                <span className="text-4xl mb-2 opacity-60 shrink-0 text-center">🖼</span>
                <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
                  <ImageAreaPlaceholder
                    sugestao={sugestao_imagem}
                    prompt={prompt_imagem}
                    fallback="Imagem sugerida para o conteúdo"
                    className="text-xs font-medium opacity-80 text-center whitespace-pre-wrap max-w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <Rodape />
      </div>
    );
  }

  // citacao_grande: fundo em cor do curso, citação em branco (contraste)
  if (layout_tipo === 'citacao_grande') {
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
            &ldquo;{citacao || titulo || 'Conteúdo'}&rdquo;
          </blockquote>
        </div>
        <div className="h-1 w-full opacity-80" style={{ backgroundColor: tema.accent || '#fff' }} />
        <footer
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs border-t border-white/20 text-white/90"
        >
          <span>{nomeCurso}</span>
          <span>Página {numeroPagina}</span>
        </footer>
      </div>
    );
  }

  // lista_icones: blocos com ícones em cor do curso (texto contrastante)
  if (layout_tipo === 'lista_icones') {
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
          {(itens.length ? itens : destaques.length ? destaques : paragrafos).map((item, i) => (
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
  if (layout_tipo === 'imagem_top') {
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
        <div
          className="w-full h-48 flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: tema.primaryDark || tema.primary }}
        >
          {imagemGerada ? (
            <img src={imagemGerada} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-[calc(100%-3rem)] h-40 rounded border-2 border-white/20 flex flex-col items-center justify-center text-white/60"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}
            >
              <span className="text-4xl opacity-60 shrink-0">🖼</span>
              <div className="mt-2 mx-2 flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
                <ImageAreaPlaceholder
                  sugestao={sugestao_imagem}
                  prompt={prompt_imagem}
                  fallback="Imagem"
                  className="text-xs text-white/75 text-center whitespace-pre-wrap max-h-32 overflow-y-auto"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 px-8 py-6 pb-4">
          {titulo && (
            <h2 className="font-sora font-bold text-xl mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
              {titulo}
            </h2>
          )}
          {paragrafos.map((p, i) => (
            <p key={i} className="mb-3 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
              {p}
            </p>
          ))}
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // Fallback: layout simples (cores do curso, texto contrastante)
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
      <div className="flex-1 px-8 py-6 pb-4">
        {titulo && (
          <h2 className="font-sora font-bold text-lg mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
            {titulo}
          </h2>
        )}
        {paragrafos.map((p, i) => (
          <p key={i} className="mb-3 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
            {p}
          </p>
        ))}
      </div>
      {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
      <Rodape />
    </div>
  );
}
