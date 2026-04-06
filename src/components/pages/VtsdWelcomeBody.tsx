'use client';

import { renderParagraphParts } from '@/components/ContentBlocksRenderer';
import {
  VTSD_INTRO_BODY_PARAGRAPHS,
  VTSD_INTRO_SIGNOFF_LINES,
  VTSD_WELCOME_KICKER,
  VTSD_WELCOME_TITLE_LINE_1,
  VTSD_WELCOME_TITLE_LINE_2,
} from '@/lib/vtsd-fixed-copy';

export interface VtsdWelcomeBodyProps {
  /** Classes extra no wrapper do corpo (ex.: page-body vtsd-welcome-body) */
  className?: string;
  /** `print` = classes do print-editorial.css; `web` = utilitários Tailwind para MaterialViewer */
  variant?: 'print' | 'web';
}

/**
 * Conteúdo textual da página de boas-vindas VTSD (título fixo + parágrafos + assinatura).
 * A arte de fundo fica em `pagina-boas-vindas.svg` (texto sobreposto).
 */
export function VtsdWelcomeBody({ className = '', variant = 'print' }: VtsdWelcomeBodyProps) {
  const isWeb = variant === 'web';

  if (isWeb) {
    return (
      <div className={className}>
        <header className="mb-5">
          <p className="text-sm font-medium text-white/95 tracking-wide mb-2">{VTSD_WELCOME_KICKER}</p>
          <h2 className="font-sora font-bold text-white text-3xl sm:text-4xl leading-tight tracking-tight m-0">
            <span className="block">{VTSD_WELCOME_TITLE_LINE_1}</span>
            <span className="block">{VTSD_WELCOME_TITLE_LINE_2}</span>
          </h2>
          <div className="w-36 h-[3px] bg-white rounded-sm mt-4 mb-6" aria-hidden />
        </header>
        <div className="space-y-4 text-[15px] leading-relaxed text-white">
          {VTSD_INTRO_BODY_PARAGRAPHS.map((p, i) => (
            <p key={i} className="m-0 text-left">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-6 space-y-1 text-[15px] leading-relaxed text-white">
          {VTSD_INTRO_SIGNOFF_LINES.map((line, i) => (
            <p key={i} className="m-0">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <header className="vtsd-welcome-header">
        <p className="vtsd-welcome-kicker">{VTSD_WELCOME_KICKER}</p>
        <h2 className="vtsd-welcome-title">
          <span className="vtsd-welcome-title-line">{VTSD_WELCOME_TITLE_LINE_1}</span>
          <span className="vtsd-welcome-title-line">{VTSD_WELCOME_TITLE_LINE_2}</span>
        </h2>
        <div className="vtsd-welcome-title-accent" aria-hidden />
      </header>
      {renderParagraphParts(VTSD_INTRO_BODY_PARAGRAPHS, 'vtsd-welcome-para')}
      <div className="vtsd-welcome-signoff">
        {VTSD_INTRO_SIGNOFF_LINES.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}
