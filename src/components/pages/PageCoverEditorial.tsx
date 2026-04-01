'use client';

/** Capa no estilo Corporate Editorial (Web-to-Print) */

export interface PageCoverEditorialProps {
  title: string;
  subtitle?: string;
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  primary?: string;
  variant?: 'default' | 'vtsd';
}

export function PageCoverEditorial({
  title,
  subtitle,
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  variant = 'default',
}: PageCoverEditorialProps) {
  return (
    <section
      className={variant === 'vtsd' ? 'page page-cover vtsd-editorial' : 'page page-cover'}
      style={{ '--print-primary': primary } as React.CSSProperties}
    >
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
