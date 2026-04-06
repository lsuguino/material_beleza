'use client';

import { ContentBlocksRenderer, renderParagraphParts, type ContentBlockItem } from '@/components/ContentBlocksRenderer';
import { contentBlocksTextCharCount, MIN_CHARS_TEXT_IN_BLOCKS } from '@/lib/normalize-content-blocks';
import { PAGINA_BOAS_VINDAS_VTSD } from '@/lib/courseThemes';
import { VtsdWelcomeBody } from '@/components/pages/VtsdWelcomeBody';

/** Template: imagem de topo sangrada + bloco de cor lateral (Corporate Editorial) */

export interface PageIntroProps {
  title: string;
  paragraphs?: string[];
  /** Quando presente, usa na ordem: primeiro bloco image = topo; resto = body (com text/mermaid) */
  contentBlocks?: ContentBlockItem[];
  imagePlaceholder?: string;
  /** IMAGE_PROMPT em inglês para o topo (ou primeiro bloco image de content_blocks) */
  imagePrompt?: string;
  /** Imagem já gerada (ex.: Gemini Nano Banana) — data URL */
  imageUrl?: string;
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  primary?: string;
  accent?: string;
  /** Venda Todo Santo Dia: diagramação alinhada ao design system de referência (artifact) */
  variant?: 'default' | 'vtsd';
  /** Página de boas-vindas VTSD: título fixo + texto institucional (ignora blocos de imagem da IA) */
  vtsdWelcome?: boolean;
}

export function PageIntro({
  title,
  paragraphs = [],
  contentBlocks,
  imagePlaceholder = 'Imagem',
  imagePrompt,
  imageUrl,
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  accent = 'var(--print-accent)',
  variant = 'default',
  vtsdWelcome = false,
}: PageIntroProps) {
  const hasContentBlocks = !vtsdWelcome && contentBlocks && contentBlocks.length > 0;
  const firstImageIndex = hasContentBlocks ? contentBlocks.findIndex((b) => b.type === 'image') : -1;
  const firstImageBlock = firstImageIndex >= 0 && contentBlocks ? contentBlocks[firstImageIndex] : null;
  const firstBlockImageUrl = firstImageBlock?.imageUrl || firstImageBlock?.imagem_url;
  const heroSrc =
    imageUrl ||
    (typeof firstBlockImageUrl === 'string' && firstBlockImageUrl.startsWith('data:') ? firstBlockImageUrl : undefined);
  const bodyBlocks =
    hasContentBlocks && contentBlocks
      ? contentBlocks.filter((_, i) => i !== firstImageIndex)
      : undefined;
  const bodyTextChars = contentBlocksTextCharCount(bodyBlocks ?? []);
  const showParagraphs =
    paragraphs.length > 0 &&
    (!bodyBlocks?.length || bodyTextChars < MIN_CHARS_TEXT_IN_BLOCKS);

  const pageClass =
    variant === 'vtsd'
      ? vtsdWelcome
        ? 'page page-intro vtsd-editorial vtsd-welcome-page'
        : 'page page-intro vtsd-editorial'
      : 'page page-intro';

  if (vtsdWelcome && variant === 'vtsd') {
    return (
      <section
        className={`${pageClass} vtsd-welcome-page--svg relative overflow-hidden`}
        style={
          {
            width: 595,
            height: 842,
            minHeight: 842,
            '--print-primary': primary,
            '--print-primary-light': primary,
            '--print-accent': accent,
          } as React.CSSProperties
        }
      >
        <img
          src={PAGINA_BOAS_VINDAS_VTSD}
          alt=""
          width={595}
          height={842}
          className="vtsd-welcome-bg pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
          draggable={false}
        />
        <VtsdWelcomeBody className="page-body vtsd-welcome-body" variant="print" />
        <div className="page-sidebar" aria-hidden />
        <footer className="page-footer vtsd-welcome-footer vtsd-welcome-footer--on-svg">
          <span className="vtsd-footer-wordmark sr-only">venda todo santo dia</span>
          {showPageNumber && typeof pageNumber === 'number' ? <span>Página {pageNumber}</span> : null}
        </footer>
      </section>
    );
  }

  return (
    <section
      className={pageClass}
      style={
        {
          '--print-primary': primary,
          '--print-primary-light': primary,
          '--print-accent': accent,
        } as React.CSSProperties
      }
    >
      {heroSrc ? (
        <div className="w-full flex-shrink-0 overflow-hidden" style={{ maxHeight: '52mm' }}>
          <img src={heroSrc} alt="" className="w-full h-full object-cover block" style={{ maxHeight: '52mm' }} />
        </div>
      ) : null}
      <div className="page-body">
        <h2>{title}</h2>
        {bodyBlocks && bodyBlocks.length > 0 ? <ContentBlocksRenderer blocks={bodyBlocks} /> : null}
        {showParagraphs ? renderParagraphParts(paragraphs, 'intro-body') : null}
      </div>
      <div className="page-sidebar" aria-hidden />
      <footer className="page-footer">
        <span>{nomeCurso}</span>
        {showPageNumber && typeof pageNumber === 'number' ? (
          <span>Página {pageNumber}</span>
        ) : null}
      </footer>
    </section>
  );
}
