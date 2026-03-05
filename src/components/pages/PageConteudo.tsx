'use client';

import type { LayoutTipo } from '@/lib/design-agent';

/** Objeto tema com cores (ex.: CourseTheme) */
export interface TemaPagina {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
  name?: string;
}

/** Sugestão de gráfico vinda da IA de conteúdo */
export interface SugestaoGraficoPagina {
  tipo: 'barra' | 'pizza' | 'linha';
  titulo: string;
  labels: string[];
  valores: number[];
}

/** Sugestão de fluxograma */
export interface SugestaoFluxogramaPagina {
  titulo: string;
  etapas: string[];
}

/** Sugestão de tabela */
export interface SugestaoTabelaPagina {
  titulo: string;
  colunas: string[];
  linhas: string[][];
}

/** Página com conteúdo + campos de design + sugestões visuais */
export interface PaginaComDesign {
  layout_tipo: LayoutTipo;
  cor_fundo_principal: string;
  cor_fundo_destaque: string;
  cor_texto_principal: string;
  cor_texto_destaque: string;
  icone_sugerido: string;
  proporcao_colunas?: '60/40' | '50/50' | '70/30';
  /** Conteúdo textual da página */
  titulo?: string;
  subtitulo?: string;
  paragrafos?: string[];
  destaques?: string[];
  citacao?: string;
  itens?: string[];
  /** Sugestões visuais da IA de conteúdo (preservadas pelo design) */
  sugestao_imagem?: string;
  prompt_imagem?: string;
  sugestao_grafico?: SugestaoGraficoPagina;
  sugestao_fluxograma?: SugestaoFluxogramaPagina;
  sugestao_tabela?: SugestaoTabelaPagina;
  sugestao_icone?: string;
  /** Barra lateral direita colorida (estilo "TABLE OF CONTENT") */
  usar_barra_lateral?: boolean;
  /** Faixa decorativa chevron/zigzag no rodapé */
  usar_faixa_decorativa?: boolean;
  [key: string]: unknown;
}

interface PageConteudoProps {
  pagina: PaginaComDesign;
  tema: TemaPagina;
  numeroPagina: number;
  nomeCurso: string;
}

function getProporcaoClasses(proporcao?: string): { left: string; right: string } {
  switch (proporcao) {
    case '70/30':
      return { left: 'w-[70%]', right: 'w-[30%]' };
    case '50/50':
      return { left: 'w-1/2', right: 'w-1/2' };
    case '60/40':
    default:
      return { left: 'w-[60%]', right: 'w-[40%]' };
  }
}

/** Faixa decorativa chevron/zigzag na cor do curso */
function FaixaChevron({ cor }: { cor: string }) {
  return (
    <div className="w-full flex-shrink-0 h-3 flex items-center" style={{ backgroundColor: cor }} aria-hidden>
      <svg width="100%" height="12" viewBox="0 0 120 12" fill="rgba(255,255,255,0.4)" preserveAspectRatio="none">
        <path d="M0 6 L10 0 L20 6 L30 0 L40 6 L50 0 L60 6 L70 0 L80 6 L90 0 L100 6 L110 0 L120 6 L120 12 L0 12 Z" />
      </svg>
    </div>
  );
}

export function PageConteudo({
  pagina,
  tema,
  numeroPagina,
  nomeCurso,
}: PageConteudoProps) {
  const {
    layout_tipo,
    cor_fundo_principal,
    cor_fundo_destaque,
    cor_texto_principal,
    cor_texto_destaque,
    titulo,
    paragrafos = [],
    destaques = [],
    citacao,
    itens = [],
    sugestao_imagem,
    prompt_imagem,
    sugestao_grafico,
    sugestao_fluxograma,
    sugestao_tabela,
    usar_barra_lateral,
    usar_faixa_decorativa,
  } = pagina;

  const proporcao = getProporcaoClasses(pagina.proporcao_colunas);

  /** Rodapé comum a todos os layouts */
  const Rodape = () => (
    <footer
      className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs border-t"
      style={{
        color: cor_texto_principal,
        borderColor: `${cor_texto_principal}30`,
      }}
    >
      <span>{nomeCurso}</span>
      <span>Página {numeroPagina}</span>
    </footer>
  );

  // header_destaque: header em cor primária (texto claro), fundo claro, texto escuro, faixa chevron opcional
  if (layout_tipo === 'header_destaque') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <header
          className="px-8 py-6 text-white font-sora font-bold"
          style={{ backgroundColor: tema.primary, color: '#fff' }}
        >
          <h2 className="text-xl md:text-2xl uppercase tracking-wide">{titulo || 'Conteúdo'}</h2>
        </header>
        <div className="flex-1 px-8 py-6 pb-4">
          {paragrafos.map((p, i) => (
            <p key={i} className="mb-4 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
              {p}
            </p>
          ))}
        </div>
        {usar_faixa_decorativa && (
          <FaixaChevron cor={tema.accent || tema.primary} />
        )}
        <Rodape />
      </div>
    );
  }

  // dois_colunas: conteúdo à esquerda; à direita: barra lateral colorida (opcional) ou destaques/fluxograma/tabela
  if (layout_tipo === 'dois_colunas') {
    const proporcaoBarraLateral = usar_barra_lateral ? { left: 'w-[70%]', right: 'w-[30%]' } : proporcao;
    const rightContent = usar_barra_lateral ? (
      <div
        className="h-full flex items-center justify-center py-8"
        style={{ backgroundColor: tema.primary, color: '#fff' }}
      >
        <span
          className="font-sora font-bold text-sm uppercase tracking-[0.3em] whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {titulo || 'Conteúdo'}
        </span>
      </div>
    ) : sugestao_fluxograma?.etapas?.length ? (
      <div className="relative pl-2">
        {sugestao_fluxograma.titulo && (
          <h3 className="font-sora font-semibold text-sm mb-3" style={{ color: cor_texto_destaque }}>
            {sugestao_fluxograma.titulo}
          </h3>
        )}
        <div className="relative border-l-2 border-dashed pl-4 space-y-3" style={{ borderColor: tema.primary }}>
          {sugestao_fluxograma.etapas.map((etapa, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white -ml-[1.4rem]"
                style={{ backgroundColor: tema.primary }}
              >
                {i + 1}
              </span>
              <span className="text-sm py-1.5 px-3 rounded-lg flex-1" style={{ backgroundColor: cor_fundo_destaque, color: cor_texto_destaque }}>
                {etapa}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : sugestao_tabela?.colunas?.length ? (
      <div className="overflow-x-auto">
        {sugestao_tabela.titulo && (
          <h3 className="font-sora font-semibold text-sm mb-2" style={{ color: cor_texto_destaque }}>
            {sugestao_tabela.titulo}
          </h3>
        )}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ backgroundColor: tema.primary, color: '#fff' }}>
              {sugestao_tabela.colunas.map((c, i) => (
                <th key={i} className="px-2 py-2 text-left font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sugestao_tabela.linhas || []).map((linha, ri) => (
              <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? cor_fundo_destaque : 'transparent', color: cor_texto_principal }}>
                {linha.map((cel, ci) => (
                  <td key={ci} className="px-2 py-1.5 border-b border-black/10">{cel}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      destaques.map((d, i) => (
        <div
          key={i}
          className="p-4 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: cor_fundo_destaque,
            color: cor_texto_destaque,
          }}
        >
          {d}
        </div>
      ))
    );

    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div className="flex flex-1 min-h-0 pb-16">
          <div className={`${proporcaoBarraLateral.left} px-8 py-6 overflow-auto`}>
            {titulo && (
              <h2 className="font-sora font-bold text-lg mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
                {titulo}
              </h2>
            )}
            {paragrafos.map((p, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
                {p}
              </p>
            ))}
          </div>
          <div className={`${proporcaoBarraLateral.right} p-4 flex flex-col gap-3 overflow-auto`}>
            {rightContent}
          </div>
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // dados_grafico: página com gráfico sugerido pela IA (barras, pizza ou linha)
  if (layout_tipo === 'dados_grafico' && sugestao_grafico?.labels?.length && sugestao_grafico?.valores?.length) {
    const maxVal = Math.max(...sugestao_grafico.valores, 1);
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div className="flex-1 px-8 py-6 pb-20">
          {titulo && (
            <h2 className="font-sora font-bold text-lg mb-2" style={{ color: cor_texto_destaque }}>
              {titulo}
            </h2>
          )}
          {sugestao_grafico.titulo && (
            <p className="text-sm mb-4 opacity-90">{sugestao_grafico.titulo}</p>
          )}
          {paragrafos.length > 0 && (
            <p className="text-sm mb-6 leading-relaxed" style={{ color: cor_texto_principal }}>
              {paragrafos[0]}
            </p>
          )}
          <div className="mt-6">
            {sugestao_grafico.tipo === 'barra' && (
              <div className="space-y-3">
                {sugestao_grafico.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-32 flex-shrink-0 text-sm" style={{ color: cor_texto_principal }}>{label}</span>
                    <div className="flex-1 h-8 rounded overflow-hidden bg-black/10">
                      <div
                        className="h-full rounded transition-all min-w-[2rem] flex items-center justify-end pr-2 text-xs font-bold text-white"
                        style={{
                          width: `${(sugestao_grafico.valores[i] ?? 0) / maxVal * 100}%`,
                          backgroundColor: tema.accent || tema.primary,
                        }}
                      >
                        {sugestao_grafico.valores[i]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sugestao_grafico.tipo === 'pizza' && (
              <div className="flex flex-wrap gap-4 items-center">
                {sugestao_grafico.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: [tema.primary, tema.accent, tema.primaryLight].filter(Boolean)[i % 3] || tema.primary }}
                    />
                    <span className="text-sm">{label}: {sugestao_grafico.valores[i]}</span>
                  </div>
                ))}
              </div>
            )}
            {sugestao_grafico.tipo === 'linha' && (
              <div className="space-y-2">
                {sugestao_grafico.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-24 flex-shrink-0">{label}</span>
                    <span className="font-semibold" style={{ color: tema.primary }}>{sugestao_grafico.valores[i]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <Rodape />
      </div>
    );
  }

  // imagem_lateral: texto à esquerda, área de imagem (sugestão) à direita
  if (layout_tipo === 'imagem_lateral') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div className="flex flex-1 min-h-0 pb-16">
          <div className="w-[55%] px-8 py-6 overflow-auto">
            {titulo && (
              <h2 className="font-sora font-bold text-lg mb-4" style={{ color: cor_texto_destaque }}>
                {titulo}
              </h2>
            )}
            {paragrafos.map((p, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed" style={{ color: cor_texto_principal }}>
                {p}
              </p>
            ))}
          </div>
          <div className="w-[45%] p-6 flex items-center justify-center">
            <div
              className="w-full aspect-square max-h-72 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center p-4"
              style={{
                borderColor: `${cor_texto_principal}40`,
                color: cor_texto_principal,
                backgroundColor: cor_fundo_destaque,
              }}
            >
              <span className="text-4xl mb-2 opacity-60">🖼</span>
              <p className="text-xs font-medium opacity-80">{sugestao_imagem || prompt_imagem || 'Imagem sugerida para o conteúdo'}</p>
            </div>
          </div>
        </div>
        <Rodape />
      </div>
    );
  }

  // citacao_grande: fundo em cor do curso, citação em branco (contraste)
  if (layout_tipo === 'citacao_grande') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: tema.primary,
          color: '#fff',
        }}
      >
        <div className="flex-1 flex items-center justify-center px-12 pb-20">
          <blockquote
            className="text-center text-2xl md:text-3xl font-sora font-medium leading-relaxed max-w-2xl text-white"
            style={{ color: '#fff' }}
          >
            &ldquo;{citacao || titulo || 'Conteúdo'}&rdquo;
          </blockquote>
        </div>
        <div className="h-1 w-full opacity-80" style={{ backgroundColor: tema.accent || '#fff' }} />
        <footer
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 text-xs border-t border-white/20 text-white/90"
        >
          <span>{nomeCurso}</span>
          <span>Página {numeroPagina}</span>
        </footer>
      </div>
    );
  }

  // lista_icones: blocos com ícones em cor do curso (texto contrastante)
  if (layout_tipo === 'lista_icones') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        {titulo && (
          <header className="px-8 pt-6">
            <h2 className="font-sora font-bold text-lg uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
              {titulo}
            </h2>
          </header>
        )}
        <div className="flex-1 grid grid-cols-2 gap-6 p-8 pb-20">
          {(itens.length ? itens : destaques.length ? destaques : paragrafos).map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                backgroundColor: cor_fundo_destaque,
                color: cor_texto_destaque,
              }}
            >
              <span
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white"
                style={{ backgroundColor: tema.primary }}
              >
                {i + 1}
              </span>
              <span className="text-sm font-medium leading-snug">{item}</span>
            </div>
          ))}
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // imagem_top: área de imagem no topo, título, texto justificado, faixa decorativa
  if (layout_tipo === 'imagem_top') {
    return (
      <div
        className="page-a4 relative flex flex-col overflow-hidden"
        style={{
          width: 595,
          height: 842,
          backgroundColor: cor_fundo_principal,
          color: cor_texto_principal,
        }}
      >
        <div
          className="w-full h-48 flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: tema.primaryDark || tema.primary }}
        >
          <div
            className="w-[calc(100%-3rem)] h-40 rounded border-2 border-white/20 flex items-center justify-center text-white/60"
            style={{ borderColor: 'rgba(255,255,255,0.3)' }}
          >
            <span className="text-4xl opacity-60">🖼</span>
            <p className="text-xs mt-2 mx-4 text-center">{sugestao_imagem || prompt_imagem || 'Imagem'}</p>
          </div>
        </div>
        <div className="flex-1 px-8 py-6 pb-4">
          {titulo && (
            <h2 className="font-sora font-bold text-xl mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
              {titulo}
            </h2>
          )}
          {paragrafos.map((p, i) => (
            <p key={i} className="mb-3 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
              {p}
            </p>
          ))}
        </div>
        {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
        <Rodape />
      </div>
    );
  }

  // Fallback: layout simples (cores do curso, texto contrastante)
  return (
    <div
      className="page-a4 relative flex flex-col overflow-hidden"
      style={{
        width: 595,
        height: 842,
        backgroundColor: cor_fundo_principal,
        color: cor_texto_principal,
      }}
    >
      <div className="flex-1 px-8 py-6 pb-4">
        {titulo && (
          <h2 className="font-sora font-bold text-lg mb-4 uppercase tracking-wide" style={{ color: cor_texto_destaque || tema.primary }}>
            {titulo}
          </h2>
        )}
        {paragrafos.map((p, i) => (
          <p key={i} className="mb-3 text-sm leading-relaxed text-justify" style={{ color: cor_texto_principal }}>
            {p}
          </p>
        ))}
      </div>
      {usar_faixa_decorativa && <FaixaChevron cor={tema.accent || tema.primary} />}
      <Rodape />
    </div>
  );
}
