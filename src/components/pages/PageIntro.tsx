'use client';

import { ContentBlocksRenderer, type ContentBlockItem } from '@/components/ContentBlocksRenderer';

/** Template: imagem de topo sangrada + bloco de cor lateral (Corporate Editorial) */

export interface PageIntroProps {
  title: string;
  paragraphs?: string[];
  /** Quando presente, usa na ordem: primeiro bloco image = topo; resto = body (com text/mermaid) */
  contentBlocks?: ContentBlockItem[];
  imagePlaceholder?: string;
  /** IMAGE_PROMPT em inglês para o topo (ou primeiro bloco image de content_blocks) */
  imagePrompt?: string;
  nomeCurso: string;
  primary?: string;
  accent?: string;
}

export function PageIntro({
  title,
  paragraphs = [],
  contentBlocks,
  imagePlaceholder = 'Imagem',
  imagePrompt,
  nomeCurso,
  primary = 'var(--print-primary)',
  accent = 'var(--print-accent)',
}: PageIntroProps) {
  const hasContentBlocks = contentBlocks && contentBlocks.length > 0;
  const firstImageIndex = hasContentBlocks ? contentBlocks.findIndex((b) => b.type === 'image') : -1;
  const firstImageBlock = firstImageIndex >= 0 && contentBlocks ? contentBlocks[firstImageIndex] : null;
  const topPrompt = imagePrompt ?? firstImageBlock?.content;
  const bodyBlocks =
    hasContentBlocks && contentBlocks
      ? contentBlocks.filter((_, i) => i !== firstImageIndex)
      : undefined;

  return (
    <section
      className="page page-intro"
      style={
        {
          '--print-primary': primary,
          '--print-primary-light': primary,
          '--print-accent': accent,
        } as React.CSSProperties
      }
    >
      <div className="page-image">
        {topPrompt ? (
          <img src="pending" data-prompt={topPrompt} alt="" className="w-full h-full object-cover" />
        ) : (
          imagePlaceholder
        )}
      </div>
      <div className="page-body">
        <h2>{title}</h2>
        {bodyBlocks && bodyBlocks.length > 0 ? (
          <ContentBlocksRenderer blocks={bodyBlocks} />
        ) : (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        )}
      </div>
      <div className="page-sidebar" aria-hidden />
      <footer className="page-footer">
        <span>{nomeCurso}</span>
        <span className="page-number">Página </span>
      </footer>
    </section>
  );
}
