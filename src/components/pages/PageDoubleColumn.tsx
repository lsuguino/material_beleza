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
  nomeCurso: string;
  primary?: string;
}

export function PageDoubleColumn({
  title,
  leftContent,
  rightContent,
  contentBlocks,
  nomeCurso,
  primary = 'var(--print-primary)',
}: PageDoubleColumnProps) {
  const left = contentBlocks?.length ? <ContentBlocksRenderer blocks={contentBlocks} /> : leftContent;

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
        <span className="page-number">Página </span>
      </footer>
    </section>
  );
}
