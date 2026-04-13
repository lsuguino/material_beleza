'use client';

/** Contra capa no estilo Resumo de Palestra Master Fluxo — página de fechamento editorial */

export interface PageContraCapaProps {
  nomeCurso: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  primary?: string;
  accent?: string;
}

export function PageContraCapa({
  nomeCurso,
  pageNumber,
  showPageNumber = true,
  primary = 'var(--print-primary)',
  accent = 'var(--print-accent)',
}: PageContraCapaProps) {
  return (
    <section
      className="page page-contracapa"
      style={
        {
          '--print-primary': primary,
          '--print-accent': accent,
        } as React.CSSProperties
      }
    >
      <div className="page-contracapa-content">
        <div className="page-contracapa-line" />
        <p className="page-contracapa-curso">{nomeCurso}</p>
        <p className="page-contracapa-master">Master Fluxo</p>
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
