'use client';

import type { TeachingMaterial, MaterialBlock } from '@/types/material';
import { COURSE_THEMES, type CourseId } from '@/lib/courseThemes';

interface MaterialViewerProps {
  material: TeachingMaterial;
  courseId?: CourseId;
}

/** Renderiza texto com **palavra** em cor de destaque (azul) */
function renderWithHighlights(text: string) {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const match = part.match(/^\*\*(.+)\*\*$/);
    if (match) {
      return (
        <span key={i} className="material-highlight text-primary dark:text-blue-300 font-semibold">
          {match[1]}
        </span>
      );
    }
    return part;
  });
}

function Block({ block }: { block: MaterialBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <h3 className="font-display text-[1.35rem] font-semibold text-black dark:text-slate-100 mt-16 mb-7 first:mt-0 tracking-tight leading-tight material-heading">
          {block.content}
        </h3>
      );
    case 'key_point':
      return (
        <div className="material-card my-14 pl-5 pr-5 py-4 rounded-xl border-l-[3px] border-primary bg-gradient-to-r from-primary/10 to-transparent dark:from-primary/10 dark:to-transparent">
          <p className="font-material material-body text-black dark:text-slate-200 leading-[1.7] text-[1.05rem]">{renderWithHighlights(block.content)}</p>
        </div>
      );
    case 'list':
      return (
        <ul className="list-none my-14 space-y-3">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex gap-3 font-material material-body text-black dark:text-slate-200 leading-relaxed">
              <span className="text-primary shrink-0 mt-0.5 font-semibold">—</span>
              <span>{renderWithHighlights(item)}</span>
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote className="my-14 pl-5 border-l-[3px] border-slate-400 dark:border-slate-500 italic material-body text-black dark:text-slate-300 font-material text-[1.05rem] leading-relaxed">
          {renderWithHighlights(block.content)}
        </blockquote>
      );
    case 'example':
      return (
        <div className="material-card my-14 p-6 rounded-xl bg-neutral-cream dark:bg-white border border-slate-200 dark:border-slate-200">
          <p className="text-slate-700 dark:text-[#0a0a0a] text-xs font-display font-bold uppercase tracking-widest mb-3">
            {block.source || 'Exemplo citado na aula'}
          </p>
          <p className="font-material material-body text-black dark:text-slate-200 leading-[1.75] text-[1.02rem]">{renderWithHighlights(block.content)}</p>
        </div>
      );
    case 'mind_map': {
      const center = block.center || 'Tema central';
      const items = block.items || [];
      const n = items.length;
      const radius = 38; // % do centro
      const cx = 50;
      const cy = 50;
      return (
        <div className="material-card my-16 py-8 px-6 rounded-xl bg-neutral-cream dark:bg-white border border-slate-200 dark:border-slate-200">
          <p className="text-slate-700 dark:text-[#0a0a0a] text-xs font-display font-bold uppercase tracking-widest text-center mb-2">
            Mapa em balões — pontos chave
          </p>
          <div className="relative w-full min-h-[320px] md:min-h-[380px]" style={{ aspectRatio: '1.1' }}>
            {/* Linhas conectando o centro a cada balão */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {items.map((_, i) => {
                const angle = n > 0 ? (2 * Math.PI * i) / n - Math.PI / 2 : 0;
                const x2 = cx + radius * Math.cos(angle);
                const y2 = cy + radius * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={cx}
                    y1={cy}
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    strokeWidth="0.8"
                    className="text-primary/40"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            {/* Balão central */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-3 rounded-full bg-primary text-white font-display font-semibold text-center text-sm shadow-md border-2 border-primary/90 min-w-[100px] max-w-[180px]"
              style={{ zIndex: 2 }}
            >
              {center}
            </div>
            {/* Balões dos pontos chave */}
            {items.map((item, i) => {
              const angle = n > 0 ? (2 * Math.PI * i) / n - Math.PI / 2 : 0;
              const x = 50 + radius * Math.cos(angle);
              const y = 50 + radius * Math.sin(angle);
              return (
                <div
                  key={i}
                  className="absolute px-4 py-2.5 rounded-full bg-white dark:bg-slate-50 border-2 border-primary/50 text-slate-800 dark:text-[#0a0a0a] font-material text-xs text-center shadow-sm hover:border-primary transition-colors min-w-[70px] max-w-[140px]"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1,
                  }}
                >
                  {item}
                </div>
              );
            })}
          </div>
          {block.content && (
            <p className="text-center material-body text-black dark:text-slate-400 text-sm mt-6 font-material max-w-md mx-auto">{renderWithHighlights(block.content)}</p>
          )}
        </div>
      );
    }
    case 'image_placeholder': {
      const layout = block.imageLayout || 'full';
      const caption = block.caption || block.content;
      if (block.imageUrl) {
        return (
          <figure className={`my-16 ${layout === 'side' ? 'max-w-lg ml-auto' : layout === 'grid' ? 'w-1/2' : ''}`}>
            <div className={`overflow-hidden rounded-sm border border-slate-200 dark:border-border-dark bg-slate-100 dark:bg-slate-800 ${layout === 'full' ? 'aspect-[4/5] md:aspect-video' : 'aspect-[4/5]'}`}>
              <img
                src={block.imageUrl}
                alt={block.content}
                className="img-editorial w-full h-full object-cover"
              />
            </div>
            {caption && (
              <figcaption className="text-[10px] uppercase tracking-tighter text-slate-600 dark:text-slate-400 mt-2 text-right font-display font-medium">
                {caption}
              </figcaption>
            )}
          </figure>
        );
      }
      return (
        <figure className={`my-16 ${layout === 'side' ? 'max-w-md' : layout === 'grid' ? 'inline-block w-[48%] align-top' : ''}`}>
          <div className={`overflow-hidden rounded-sm bg-neutral-cream dark:bg-slate-800 border border-slate-200 dark:border-border-dark flex items-center justify-center ${layout === 'full' ? 'aspect-[4/5]' : 'aspect-[4/5]'}`}>
            <div className="text-center px-6 py-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-2xl">
                🖼
              </div>
              <p className="font-material text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
                {block.content}
              </p>
              {block.imagePrompt && (
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-2 font-display uppercase tracking-tight font-medium">
                  {block.imagePrompt}
                </p>
              )}
            </div>
          </div>
          {caption && (
            <figcaption className="text-[10px] uppercase tracking-tighter text-slate-600 dark:text-slate-400 mt-2 text-right font-display font-medium">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case 'flowchart': {
      const steps = block.steps || [];
      if (steps.length === 0) return null;
      return (
        <div className="material-card my-16 py-8 px-6 rounded-xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200">
          {block.diagramTitle && (
            <p className="text-slate-800 dark:text-[#0a0a0a] text-xs font-display font-bold uppercase tracking-widest mb-6 text-center">
              {block.diagramTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-0 md:flex-nowrap">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="px-4 py-3 rounded-lg border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 text-slate-800 dark:text-[#0a0a0a] text-sm font-medium text-center min-w-[120px] max-w-[180px]">
                  {step}
                </div>
                {i < steps.length - 1 && (
                  <span className="hidden md:inline mx-1 text-primary/50 font-bold">→</span>
                )}
              </div>
            ))}
          </div>
          {block.content && (
            <p className="material-body text-black dark:text-slate-300 text-sm font-material mt-6 text-center max-w-2xl mx-auto">{renderWithHighlights(block.content)}</p>
          )}
        </div>
      );
    }
    case 'chart': {
      const labels = block.chartLabels || [];
      const values = block.chartValues || [];
      const type = block.chartType || 'bar';
      const maxVal = values.length ? Math.max(...values) : 1;
      return (
        <div className="material-card my-16 py-8 px-6 rounded-xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200">
          {block.diagramTitle && (
            <p className="chart-title text-slate-900 dark:text-[#0a0a0a] text-sm font-display font-bold mb-6 text-center">
              {block.diagramTitle}
            </p>
          )}
          <div className="flex flex-col gap-4 max-w-xl mx-auto">
            {type === 'bar' && labels.map((label, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="chart-label text-slate-800 dark:text-[#0a0a0a] text-sm font-medium w-24 shrink-0">{label}</span>
                <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary rounded transition-all duration-500"
                    style={{ width: `${(values[i] ?? 0) / maxVal * 100}%` }}
                  />
                </div>
                <span className="chart-value text-slate-800 dark:text-[#0a0a0a] text-xs font-semibold w-8 text-right">{values[i] ?? 0}</span>
              </div>
            ))}
            {type === 'pie' && values.length > 0 && (() => {
              const total = values.reduce((a, b) => a + b, 0) || 1;
              const colors = ['#135bec', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'];
              let acc = 0;
              const stops = values.map((v, i) => {
                const start = (acc / total) * 100;
                acc += v;
                const end = (acc / total) * 100;
                return `${colors[i % colors.length]} ${start}% ${end}%`;
              }).join(', ');
              return (
                <div key="pie" className="flex flex-col sm:flex-row items-center gap-6">
                  <div
                    className="size-40 rounded-full border-4 border-white shadow-inner"
                    style={{ background: `conic-gradient(${stops})` }}
                  />
                <ul className="flex flex-col gap-2">
                  {labels.map((label, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: ['#135bec', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'][i % 5] }} />
                      <span className="text-slate-800 dark:text-[#0a0a0a] font-medium">{label}</span>
                      <span className="text-slate-700 dark:text-[#0a0a0a] text-xs font-medium">({values[i] ?? 0})</span>
                    </li>
                  ))}
                </ul>
                </div>
              );
            })()}
            {type === 'line' && values.length > 0 && (
              <div className="h-48 flex items-end justify-between gap-1 px-2">
                {values.map((val, i) => (
                  <div key={i} className="flex-1 h-48 flex flex-col justify-end items-center gap-1">
                    <div
                      className="w-full bg-primary/80 rounded-t min-h-[4px] transition-all duration-500"
                      style={{ height: `${maxVal ? (val / maxVal) * 100 : 0}%` }}
                    />
                    {labels[i] && <span className="text-[10px] text-slate-800 dark:text-[#0a0a0a] font-medium truncate max-w-full">{labels[i]}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {block.content && (
            <p className="material-body text-black dark:text-slate-300 text-sm font-material mt-6 text-center max-w-2xl mx-auto">{renderWithHighlights(block.content)}</p>
          )}
        </div>
      );
    }
    case 'paragraph':
    default:
      return (
        <p className="font-material material-body text-black dark:text-slate-100 leading-[1.8] my-12 text-[1.02rem] material-paragraph">
          {renderWithHighlights(block.content)}
        </p>
      );
  }
}

/** Ilustração decorativa para capa (diagramação de livro) */
function CoverPlaceholderIllustration() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.08] pointer-events-none">
      <svg viewBox="0 0 400 320" className="w-full max-w-md h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="140" r="80" stroke="currentColor" strokeWidth="1.5" className="text-book-blue" />
        <rect x="140" y="100" width="120" height="80" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-book-blue" />
        <path d="M160 140 L240 140 M160 160 L220 160 M160 180 L200 180" stroke="currentColor" strokeWidth="1" className="text-book-blue" />
      </svg>
    </div>
  );
}

export function MaterialViewer({ material, courseId = 'geral' }: MaterialViewerProps) {
  const hasCoverImage = Boolean(material.coverImageUrl);
  const theme = COURSE_THEMES[courseId];

  return (
    <article
      className={`material-article book-layout book-landscape rounded-xl overflow-hidden print:shadow-none print:rounded-none border border-slate-200/80 dark:border-slate-600/50 shadow-sm ${theme.layoutClass}`}
      style={{
        ['--theme-primary' as string]: theme.primary,
        ['--theme-primary-dark' as string]: theme.primaryDark,
        ['--theme-accent' as string]: theme.accent,
        ['--book-blue' as string]: theme.primaryDark,
      }}
    >
      {/* Capa — diagramação de livro: fundo creme, faixa azul opcional */}
      <header className="relative min-h-[420px] md:min-h-[480px] print:min-h-0 print:py-8 flex flex-col md:flex-row print:flex-row print:break-after-page overflow-hidden material-viewer-header cover-page bg-book-cream">
        <div className="absolute inset-0 bg-book-cream" aria-hidden />
        <div className="absolute top-0 left-0 w-1.5 md:w-2 h-full bg-book-blue" aria-hidden />
        <CoverPlaceholderIllustration />

        <div className="cover-image-column relative flex-shrink-0 w-full md:w-[42%] min-h-[200px] md:min-h-0 flex items-center justify-center p-6 md:p-10 print:p-4">
          {hasCoverImage ? (
            <div className="cover-image-frame relative w-full max-w-[240px] md:max-w-xs aspect-[4/5] md:aspect-square rounded-sm overflow-hidden shadow-lg border border-book-blue/20 print:shadow-md">
              <img
                src={material.coverImageUrl}
                alt=""
                className="w-full h-full object-cover img-editorial"
              />
            </div>
          ) : (
            <div className="cover-placeholder relative w-full max-w-[240px] md:max-w-xs aspect-[4/5] md:aspect-square rounded-sm overflow-hidden bg-book-blue/10 border border-book-blue/30 flex items-center justify-center print:border-book-blue/40">
              <span className="cover-initial font-display font-black text-6xl md:text-7xl text-book-blue/40 select-none" aria-hidden>
                {(material.title.trim()[0] || 'A').toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="cover-text-column relative flex-1 flex flex-col justify-center px-6 py-8 md:px-12 md:py-16 lg:px-16 print:px-6 print:py-4 min-w-0">
          <span className="material-label inline-block font-display font-bold tracking-[0.2em] uppercase text-[10px] mb-4 text-book-blue">
            Apostila de estudos
          </span>
          <h1 className="material-title font-display text-3xl sm:text-4xl md:text-5xl lg:text-[2.75rem] font-black leading-[1.12] tracking-tight mb-5 text-book-blue">
            {material.title}
          </h1>
          {material.subtitle && (
            <p className="material-subtitle text-base sm:text-lg font-material leading-relaxed text-slate-700 mb-6">
              {renderWithHighlights(material.subtitle)}
            </p>
          )}
          {material.summary && (
            <p className="material-summary text-sm sm:text-base leading-[1.7] max-w-xl text-slate-700">
              {renderWithHighlights(material.summary)}
            </p>
          )}
        </div>
      </header>

      {/* Sumário — painel azul escuro (estilo livro); página seguinte à capa */}
      <nav className="material-toc book-toc print:break-after-page bg-book-blue text-white py-12 md:py-16 print:py-12" aria-label="Sumário">
        <div className="max-w-4xl mx-auto px-8 md:px-16 flex flex-col md:flex-row md:items-stretch gap-8 md:gap-12">
          <h2 className="book-toc-title font-display text-lg font-bold tracking-[0.35em] uppercase shrink-0 flex items-center justify-center md:justify-start md:py-4 md:border-r md:border-white/30 md:pr-10">
            <span className="md:[writing-mode:vertical-rl] md:inline-block md:py-4">Sumário</span>
          </h2>
          <ol className="list-none space-y-3 flex-1 py-2">
            {material.sections?.map((section, idx) => (
              <li key={idx} className="flex items-baseline gap-3 font-display text-base md:text-lg">
                <span className="font-semibold text-white/90 shrink-0 w-7">
                  {(String(idx + 1).padStart(2, '0'))}
                </span>
                <span className="text-white/95">{section.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Conteúdo — seções em diagramação de livro A4 deitada (layout largo, 2 colunas) */}
      <div className="material-content book-content book-content-landscape px-6 md:px-12 lg:px-16 py-10 md:py-14 max-w-6xl mx-auto print:py-8 print:max-w-none bg-book-cream">
        {material.sections?.map((section, idx) => (
          <section key={idx} className="mb-28 last:mb-0 print:break-inside-avoid">
            <div className="flex items-baseline gap-4 mb-12 pb-5 border-b-2 border-book-blue">
              <span className="book-section-num font-display font-bold text-book-blue text-2xl md:text-3xl">
                {(String(idx + 1).padStart(2, '0'))}
              </span>
              <h2 className="font-display text-xl md:text-2xl font-bold text-book-blue tracking-tight material-heading">
                {section.title}
              </h2>
            </div>
            <div className="book-section-body lg:columns-2 lg:gap-12 space-y-0 text-slate-800">
              {section.blocks?.map((block, bidx) => (
                <Block key={bidx} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Rodapé — estilo livro */}
      <footer className="border-t border-book-blue/30 px-8 md:px-16 py-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-book-cream">
        <p className="text-xs text-slate-600 font-medium tracking-widest uppercase">
          © {new Date().getFullYear()} Design Beleza
        </p>
        <div className="flex gap-8">
          <a className="text-xs text-book-blue hover:underline font-medium uppercase tracking-widest" href="#">Suporte</a>
          <a className="text-xs text-book-blue hover:underline font-medium uppercase tracking-widest" href="#">Políticas</a>
        </div>
      </footer>
    </article>
  );
}
