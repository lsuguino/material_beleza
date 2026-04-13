'use client';

import type { CSSProperties } from 'react';
import { VTSD_PAGE } from '@/lib/vtsd-design-system';

export interface PageAtividadesFinaisProps {
  questions: string[];
  /** Linhas em branco para o leitor escrever (padrão 5). */
  answerLines?: number;
  primary?: string;
  pageNumber?: number;
  showPageNumber?: boolean;
  variant?: 'vtsd' | 'default';
}

/**
 * Página final de atividades: perguntas sobre o material + linhas para resposta à mão.
 */
export function PageAtividadesFinais({
  questions,
  answerLines = 5,
  primary = '#135bec',
  pageNumber,
  showPageNumber = true,
  variant = 'vtsd',
}: PageAtividadesFinaisProps) {
  const qs = questions.filter((q) => String(q).trim());
  const n = Math.max(1, Math.min(12, Math.floor(answerLines)));

  const bg = variant === 'vtsd' ? '#ffffff' : '#fafafa';

  return (
    <section
      className="page page-atividades-finais vtsd-editorial relative box-border overflow-hidden"
      style={
        {
          width: VTSD_PAGE.largura_px,
          height: VTSD_PAGE.altura_px,
          minHeight: VTSD_PAGE.altura_px,
          backgroundColor: bg,
        } as CSSProperties
      }
    >
      <div
        className="box-border flex h-full flex-col"
        style={{ padding: '48px 50px 56px', fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <header className="mb-5 shrink-0 border-b-2 pb-3" style={{ borderColor: primary }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Atividades</p>
          <h2 className="font-['Sora',system-ui,sans-serif] text-[22px] font-bold leading-tight text-slate-900">
            Perguntas sobre o conteúdo
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
            Reflita sobre o que você estudou neste material. Use o espaço abaixo para registrar suas respostas.
          </p>
        </header>

        <ol className="mb-6 list-decimal space-y-3 pl-5 text-[13px] leading-snug text-slate-800">
          {qs.map((q, i) => (
            <li key={i} className="pl-1 marker:font-semibold marker:text-slate-700">
              {q}
            </li>
          ))}
        </ol>

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suas respostas</p>
        <div className="flex flex-col gap-1">
          {Array.from({ length: n }).map((_, i) => (
            <div
              key={i}
              className="h-10 shrink-0 border-b border-slate-400"
              style={{ borderBottomStyle: 'solid', borderBottomWidth: 1 }}
            />
          ))}
        </div>
      </div>

      {showPageNumber && typeof pageNumber === 'number' ? (
        <footer
          className="absolute bottom-0 left-0 right-0 flex justify-center pb-3 text-[11px] text-slate-500"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          Página {pageNumber}
        </footer>
      ) : null}
    </section>
  );
}
