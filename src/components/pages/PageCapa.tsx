'use client';

import Image from 'next/image';
import { CAPA_PADRAO_VTSD } from '@/lib/courseThemes';

/** Objeto tema com cores (ex.: CourseTheme) */
export interface TemaCapa {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
  name?: string;
}

interface PageCapaProps {
  titulo: string;
  subtitulo?: string;
  nomeCurso: string;
  tema: TemaCapa;
  /** Quando fornecido (ex.: 'geral' para Venda Todo Santo Dia), usa a capa padrão do curso */
  cursoId?: string;
}

const COR_FUNDO_ESCURO = '#0D0D14';

/** ID do curso que usa a capa padrão (imagem fixa) */
const CURSO_COM_CAPA_PADRAO = 'geral';

export function PageCapa({
  titulo,
  subtitulo,
  nomeCurso,
  tema,
  cursoId,
}: PageCapaProps) {
  const usaCapaPadrao = cursoId === CURSO_COM_CAPA_PADRAO;

  if (usaCapaPadrao) {
    return (
      <div
        className="page-a4 relative overflow-hidden bg-white"
        style={{
          width: 595,
          height: 842,
        }}
      >
        <Image
          src={CAPA_PADRAO_VTSD}
          alt={`Capa do curso ${nomeCurso}`}
          fill
          className="object-cover object-center"
          sizes="595px"
          priority
        />
      </div>
    );
  }

  return (
    <div
      className="page-a4 relative flex flex-col overflow-hidden"
      style={{
        width: 595,
        height: 842,
        backgroundColor: COR_FUNDO_ESCURO,
      }}
    >
      {/* Bloco superior: cor primária — 40% da altura */}
      <div
        className="flex flex-1 min-h-0 items-center justify-center px-12"
        style={{
          height: '40%',
          minHeight: '40%',
          backgroundColor: tema.primary,
        }}
      >
        <h1
          className="font-sora font-bold text-white text-center text-3xl md:text-4xl leading-tight max-w-xl"
          style={{ fontFamily: 'var(--font-sora), Sora, system-ui, sans-serif' }}
        >
          {titulo}
        </h1>
      </div>

      {/* Parte inferior: subtítulo, nome do curso, linha, rodapé */}
      <div className="flex flex-col flex-1 px-10 pt-8 pb-6 text-white">
        {subtitulo && (
          <p className="text-lg md:text-xl text-white/95 font-medium mb-4">
            {subtitulo}
          </p>
        )}
        <p className="text-sm text-white/80 font-medium uppercase tracking-wider">
          {nomeCurso}
        </p>

        {/* Linha decorativa na cor primária */}
        <div
          className="mt-6 h-1 w-24 rounded-full"
          style={{ backgroundColor: tema.primary }}
        />

        {/* Rodapé */}
        <footer className="mt-auto pt-8 text-xs text-white/60 uppercase tracking-widest">
          {nomeCurso}
        </footer>
      </div>
    </div>
  );
}
