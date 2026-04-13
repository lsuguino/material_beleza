'use client';

/** Template: barra lateral colorida + lista numerada (Corporate Editorial) */

export interface PageSummaryProps {
  title: string;
  items: string[];
  /** Número real da primeira página de cada item (alinhado com a numeração do PDF) */
  startPages?: number[];
  sidebarLabel?: string;
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  /** Cores para rebrand (aplicadas como variáveis no container) */
  primary?: string;
  accent?: string;
  variant?: 'default' | 'vtsd';
}

export function PageSummary({
  title,
  items,
  startPages,
  sidebarLabel = 'Conteúdo',
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  accent = 'var(--print-accent)',
  variant = 'default',
}: PageSummaryProps) {
  return (
    <section
      className={variant === 'vtsd' ? 'page page-summary vtsd-editorial' : 'page page-summary'}
      style={
        {
          '--print-primary': primary,
          '--print-accent': accent,
        } as React.CSSProperties
      }
    >
      <div className="page-sidebar">
        <span className="page-sidebar-title">{sidebarLabel}</span>
      </div>
      <div className="page-body">
        <h2>{title}</h2>
        <ul className="page-list">
          {items.map((text, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="page-list-num">{i + 1}</span>
              <span style={{ flex: 1 }}>{text}</span>
              {startPages?.[i] != null ? (
                <span style={{ flexShrink: 0, fontSize: '11px', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                  p. {startPages[i]}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
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
