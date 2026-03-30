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
}: PageDoubleColumnProps) {
  const left = (
    <>
      {contentBlocks?.length ? <ContentBlocksRenderer blocks={contentBlocks} /> : leftContent}
      {afterBlocksContent}
    </>
  );

  return (
    <section
      className="page page-double-column"
      style={{ '--print-primary': primary } as React.CSSProperties}
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
