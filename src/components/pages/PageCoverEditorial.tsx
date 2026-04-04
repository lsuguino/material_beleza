'use client';

import type { CSSProperties } from 'react';
import { VTSD_COLOR, VTSD_MARGENS_A4, vtsdCoverWatermarkFromTitle } from '@/lib/vtsd-design-system';

/** Capa no estilo Corporate Editorial (Web-to-Print) */

export interface PageCoverEditorialProps {
  title: string;
  subtitle?: string;
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  primary?: string;
  variant?: 'default' | 'vtsd';
  /** Trecho na faixa branca inferior (ex.: primeiro parágrafo do bloco da capa) */
  excerpt?: string;
}

const PG = VTSD_MARGENS_A4.margens.topo_px;
const SIDE = VTSD_MARGENS_A4.margens.lateral_px;
const AREA_W = VTSD_MARGENS_A4.area_util.largura_px;

function VtsdCoverBadge({ numero, bg }: { numero: number; bg: string }) {
  const b = VTSD_MARGENS_A4.badge_pagina;
  return (
    <div
      className="absolute z-[2] flex items-center justify-center font-display font-semibold text-[11px] leading-[14px] pointer-events-none text-white"
      style={{
        left: b.x_px,
        top: b.y_px,
        width: b.largura_px,
        height: b.altura_px,
        backgroundColor: bg,
        borderRadius: b.border_radius,
      }}
      aria-hidden
    >
      {String(numero).padStart(2, '0')}
    </div>
  );
}

/**
 * Capa VTSD alinhada ao layout A4_1_abertura (Book DS): fundo cinza, bloco teal com título,
 * faixa gradiente com watermark, faixa branca com texto e badge de página.
 */
export function PageCoverEditorial({
  title,
  subtitle,
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  variant = 'default',
  excerpt,
}: PageCoverEditorialProps) {
  if (variant === 'vtsd') {
    const blocoEscuro = VTSD_COLOR.primary_darker;
    const watermark = vtsdCoverWatermarkFromTitle(title);
    const stripText =
      (excerpt && excerpt.trim()) ||
      (subtitle && subtitle.trim()) ||
      `Material de apoio — ${nomeCurso}.`;

    const headerH = 350;
    const bandH = 210;
    const gap = 10;
    const whiteTop = PG + headerH + gap + bandH + gap;

    const badgeNum = pageNumber ?? 1;

    return (
      <div
        className="page-a4 relative overflow-hidden font-display vtsd-book-cover"
        style={{
          width: 595,
          height: 842,
          backgroundColor: VTSD_COLOR.fundo_externo,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <div
          className="absolute flex flex-col z-[1]"
          style={{
            left: SIDE,
            top: PG,
            width: AREA_W,
            height: headerH,
            backgroundColor: blocoEscuro,
            padding: '50px 50px 20px 50px',
            boxSizing: 'border-box',
          }}
        >
          <h1 className="font-sora font-bold text-[40px] leading-[48px] tracking-[-0.025em] text-white m-0">
            {title}
          </h1>
          {subtitle ? (
            <p
              className="font-display text-[17px] leading-[20px] mt-4 m-0"
              style={{ color: VTSD_COLOR.primary_lighter }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className="absolute z-0 overflow-hidden"
          style={{
            left: SIDE,
            top: PG + headerH + gap,
            width: AREA_W,
            height: bandH,
            background: `linear-gradient(95deg, #022f3f 0%, ${VTSD_COLOR.primary_darker} 22%, #047a8c 52%, ${VTSD_COLOR.primary_dark} 72%, #12a0b0 88%, #1eb4c4 100%)`,
          }}
          aria-hidden
        >
          <span
            className="absolute font-sora font-bold select-none pointer-events-none whitespace-nowrap"
            style={{
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '110px',
              lineHeight: 1,
              color: 'rgba(255,255,255,0.12)',
              letterSpacing: '-0.04em',
            }}
          >
            {watermark}
          </span>
        </div>

        <div
          className="absolute z-[1]"
          style={{
            left: SIDE,
            top: whiteTop,
            width: AREA_W,
            maxHeight: VTSD_MARGENS_A4.area_util.y_fim_px - whiteTop,
            backgroundColor: VTSD_COLOR.fundo_page,
            padding: '28px 50px 36px 50px',
            boxSizing: 'border-box',
          }}
        >
          <p
            className="font-display text-[14px] leading-[22px] m-0 text-justify"
            style={{ color: VTSD_COLOR.texto_800 }}
          >
            {stripText}
          </p>
          <p
            className="font-display text-[10px] leading-[13px] mt-5 m-0 uppercase tracking-[0.12em]"
            style={{ color: VTSD_COLOR.texto_600 }}
          >
            {nomeCurso}
          </p>
        </div>

        {showPageNumber ? <VtsdCoverBadge numero={badgeNum} bg={VTSD_COLOR.primary_dark} /> : null}
      </div>
    );
  }

  return (
    <section className="page page-cover" style={{ '--print-primary': primary } as CSSProperties}>
      <h1 className="page-cover-title">{title}</h1>
      {subtitle && <p className="page-cover-subtitle">{subtitle}</p>}
      <p className="page-cover-subtitle" style={{ marginTop: 'auto', fontSize: '10px' }}>
        {nomeCurso}
      </p>
      <footer className="page-footer">
        <span>{nomeCurso}</span>
        {showPageNumber && typeof pageNumber === 'number' ? (
          <span>Página {pageNumber}</span>
        ) : null}
      </footer>
    </section>
  );
}
