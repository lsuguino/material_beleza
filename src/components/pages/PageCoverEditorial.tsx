'use client';

import type { CSSProperties } from 'react';
import { CAPA_PADRAO_VTSD } from '@/lib/courseThemes';
import { VTSD_COLOR, VTSD_MARGENS_A4 } from '@/lib/vtsd-design-system';

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

const b = VTSD_MARGENS_A4.badge_pagina;

function VtsdCoverBadge({ numero, bg }: { numero: number; bg: string }) {
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
 * Capa VTSD: arte oficial em SVG (`capa.svg`) + texto dinâmico.
 * Posições alinhadas à referência `capa-com-informacoes.svg` em /public/capas/venda-todo-santo-dia/.
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
    const stripText =
      (excerpt && excerpt.trim()) ||
      (subtitle && subtitle.trim()) ||
      `Material de apoio — ${nomeCurso}.`;
    const moduleLine = (subtitle && subtitle.trim()) || nomeCurso;
    const badgeNum = pageNumber ?? 1;

    return (
      <div
        className="page-a4 relative overflow-hidden font-display vtsd-book-cover"
        style={{
          width: 595,
          height: 842,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <img
          src={CAPA_PADRAO_VTSD}
          alt=""
          width={595}
          height={842}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
          draggable={false}
        />
        <div
          className="absolute inset-0 z-[1] flex flex-col text-[#202020]"
          style={{
            padding: '56px 48px 120px 48px',
            boxSizing: 'border-box',
          }}
        >
          {/* Curso/módulo discreto no topo */}
          <p className="font-display text-[13px] font-light tracking-tight leading-snug m-0 opacity-75">
            {moduleLine}
          </p>
          {/* Título principal da aula */}
          <h1
            className="mt-4 font-sora font-bold text-[32px] leading-[1.12] tracking-[-0.02em] m-0 max-w-[95%]"
            style={{ fontFamily: 'var(--font-sora), Sora, system-ui, sans-serif' }}
          >
            {title}
          </h1>
          {/* Subtítulo — apenas uma vez, abaixo do título */}
          {subtitle?.trim() ? (
            <p className="mt-5 font-display text-[13px] leading-[1.45] m-0 max-w-full text-justify opacity-90">
              {subtitle.trim()}
            </p>
          ) : null}
        </div>
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
