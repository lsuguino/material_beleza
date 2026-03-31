'use client';

import React from 'react';
import { ContentBlocksRenderer, type ContentBlockItem } from '@/components/ContentBlocksRenderer';

/** Template: duas colunas com linha divisória superior (Corporate Editorial) */

export interface PageDoubleColumnProps {
  title?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  /** Quando presente, renderiza no lugar de leftContent (placeholders img/mermaid) */
  contentBlocks?: ContentBlockItem[];
  /** Texto da página (bloco_principal etc.) quando os blocos não trazem texto suficiente */
  afterBlocksContent?: React.ReactNode;
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  primary?: string;
  accent?: string;
  /** Venda Todo Santo Dia: diagramação alinhada ao design system de referência */
  variant?: 'default' | 'vtsd';
}

export function PageDoubleColumn({
  title,
  leftContent,
  rightContent,
  contentBlocks,
  afterBlocksContent,
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  accent = 'var(--print-accent)',
  variant = 'default',
}: PageDoubleColumnProps) {
  const left = (
    <>
      {contentBlocks?.length ? <ContentBlocksRenderer blocks={contentBlocks} /> : leftContent}
      {afterBlocksContent}
    </>
  );

  const pageClass =
    variant === 'vtsd' ? 'page page-double-column vtsd-editorial' : 'page page-double-column';

  return (
    <section
      className={pageClass}
      style={{ '--print-primary': primary, '--print-accent': accent } as React.CSSProperties}
    >
      <div className="page-divider" aria-hidden />
      <div className="page-col page-body">
        {title && <h2>{title}</h2>}
        {left}
      </div>
      <div className="page-col page-body">
        {rightContent ?? null}
      </div>
      <footer className="page-footer">
        <span>{nomeCurso}</span>
        {showPageNumber && typeof pageNumber === 'number' ? (
          <span>Página {pageNumber}</span>
        ) : null}
      </footer>
    </section>
  );
}
