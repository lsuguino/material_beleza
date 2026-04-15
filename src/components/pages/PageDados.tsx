'use client';

/** Objeto tema com cores (ex.: CourseTheme) */
export interface TemaDados {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
  name?: string;
}

interface PageDadosProps {
  dado_numerico: string | number;
  contexto: string;
  destaques: string[];
  tema: TemaDados;
  numeroPagina: number;
  nomeCurso: string;
}

export function PageDados({
  dado_numerico,
  contexto,
  destaques,
  tema,
  numeroPagina,
  nomeCurso,
}: PageDadosProps) {
  const primaryRgba = (opacity: number) => {
    const hex = tema.primary.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  };

  return (
    <div
      className="page-a4 relative flex flex-col overflow-hidden bg-white"
      style={{
        width: 595,
        height: 842,
      }}
    >
      <div className="flex-1 flex flex-col px-10 pt-10 pb-20">
        {/* Número grande em destaque (mínimo 72px, cor primária) */}
        <div className="text-center mb-6">
          <span
            className="font-sora font-bold tabular-nums"
            style={{
              fontSize: 'clamp(72px, 12vw, 120px)',
              color: tema.primary,
              lineHeight: 1,
            }}
          >
            {dado_numerico}
          </span>
        </div>

        {/* Texto de contexto abaixo */}
        <p className="text-center text-slate-700 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          {contexto}
        </p>

        {/* Blocos de bullets em cards com fundo suave */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {destaques.map((destaque, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl border-l-4"
              style={{
                backgroundColor: primaryRgba(0.06),
                borderLeftColor: tema.primary,
              }}
            >
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: tema.primary }}
              >
                {i + 1}
              </span>
              <span className="text-slate-800 text-sm font-medium leading-snug">
                {destaque}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé padrão */}
      <footer
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs text-slate-400"
      >
        <span>{nomeCurso}</span>
        <span>Página {numeroPagina}</span>
      </footer>
    </div>
  );
}
