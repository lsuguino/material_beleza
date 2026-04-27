'use client';

import type { CSSProperties } from 'react';
import { renderParagraphParts } from '@/components/ContentBlocksRenderer';
import { PAGINA_CONCLUSAO_VTSD_FUNDO } from '@/lib/courseThemes';
import { VTSD_CONCLUSAO_PARAGRAPHS, VTSD_CONCLUSAO_TITULO } from '@/lib/vtsd-conclusao-copy';

export interface PageConclusaoVtsdProps {
  pageNumber?: number;
  showPageNumber?: boolean;
  titulo?: string;
  blocoPrincipal?: string;
}

function paragraphsFromBloco(blocoPrincipal?: string): string[] {
  const raw = blocoPrincipal?.trim();
  if (!raw) return [...VTSD_CONCLUSAO_PARAGRAPHS];
  const parts = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [...VTSD_CONCLUSAO_PARAGRAPHS];
}

/**
 * Página final VTSD: arte da referência (`pagina-conclusao-fundo.svg`) + texto em HTML.
 *
 * Conforme spec do usuário (referência da arte oficial VTSD):
 * - SEM título "CONCLUSÃO" visual (a arte do SVG já comunica o fechamento)
 * - SEM número de página (página final, não navegável)
 * - Body centralizado verticalmente, acima do logo "vendatodo Santodia"
 *   embutido no SVG de fundo
 */
export function PageConclusaoVtsd({
  pageNumber: _pageNumber,
  showPageNumber: _showPageNumber = false,
  titulo = VTSD_CONCLUSAO_TITULO,
  blocoPrincipal,
}: PageConclusaoVtsdProps) {
  void _pageNumber;
  void _showPageNumber;
  const parasH = paragraphsFromBloco(blocoPrincipal);

  return (
    <section
      className="page page-conclusao-vtsd vtsd-editorial vtsd-conclusao-page--svg relative overflow-hidden"
      style={
        {
          width: 595,
          height: 842,
          minHeight: 842,
        } as CSSProperties
      }
    >
      <img
        src={PAGINA_CONCLUSAO_VTSD_FUNDO}
        alt=""
        width={595}
        height={842}
        className="vtsd-conclusao-bg pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
        draggable={false}
      />
      <div className="page-body vtsd-conclusao-body relative z-[1] box-border">
        {/* Título mantido pra acessibilidade, escondido visualmente */}
        <h2 className="vtsd-conclusao-title sr-only">{titulo}</h2>
        {renderParagraphParts(parasH, 'vtsd-conclusao-para')}
      </div>
      <div className="page-sidebar" aria-hidden />
    </section>
  );
}
