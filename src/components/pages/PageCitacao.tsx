'use client';

/** Objeto tema com cores (ex.: CourseTheme) */
export interface TemaCitacao {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
  name?: string;
}

interface PageCitacaoProps {
  citacao: string;
  autor?: string;
  tema: TemaCitacao;
  numeroPagina: number;
  nomeCurso: string;
}

export function PageCitacao({
  citacao,
  autor,
  tema,
  numeroPagina,
  nomeCurso,
}: PageCitacaoProps) {
  return (
    <div
      className="page-a4 relative flex flex-col overflow-hidden"
      style={{
        width: 595,
        height: 842,
        backgroundColor: tema.primary,
      }}
    >
      {/* Aspas decorativas gigantes no fundo (opacity baixa) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden
      >
        <span
          className="font-serif text-[280px] md:text-[320px] leading-none opacity-[0.12] text-white"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          &ldquo;
        </span>
      </div>

      {/* Conteúdo central */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-12 py-16 pb-20 text-center">
        <blockquote
          className="text-white font-medium leading-relaxed max-w-xl"
          style={{
            fontSize: 'clamp(32px, 4vw, 42px)',
            minHeight: '2.5em',
          }}
        >
          {citacao}
        </blockquote>
        {autor && (
          <cite className="mt-6 text-white/90 text-lg not-italic font-medium">
            — {autor}
          </cite>
        )}
      </div>

      {/* Rodapé padrão */}
      <footer
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs text-white/60"
      >
        <span>{nomeCurso}</span>
        <span>Página {numeroPagina}</span>
      </footer>
    </div>
  );
}
