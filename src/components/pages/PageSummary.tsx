'use client';

/** Template: barra lateral colorida + lista numerada (Corporate Editorial) */

export interface PageSummaryProps {
  title: string;
  items: string[];
  sidebarLabel?: string;
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  /** Cores para rebrand (aplicadas como variáveis no container) */
  primary?: string;
  accent?: string;
}

export function PageSummary({
  title,
  items,
  sidebarLabel = 'Conteúdo',
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  accent = 'var(--print-accent)',
}: PageSummaryProps) {
  return (
    <section
      className="page page-summary"
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
            <li key={i}>
              <span className="page-list-num">{i + 1}</span>
              <span>{text}</span>
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
