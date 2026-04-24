'use client';

import type { TeachingMaterial, MaterialBlock } from '@/types/material';
import { CAPA_PADRAO_VTSD, COURSE_THEMES, PAGINA_BOAS_VINDAS_VTSD, type CourseId } from '@/lib/courseThemes';
import { VtsdWelcomeBody } from '@/components/pages/VtsdWelcomeBody';

interface MaterialViewerProps {
  material: TeachingMaterial;
  courseId?: CourseId;
}

function extractLessonNumber(title: string): string {
  const m = title.match(/\b(\d{1,3})\b/);
  return m?.[1] ?? '01';
}

/** Segmentos do gráfico de pizza seguem a cor de destaque (Scribo). */
const PIE_CHART_COLORS = [
  'var(--scribo-primary)',
  'color-mix(in srgb, var(--scribo-primary) 78%, white)',
  'color-mix(in srgb, var(--scribo-primary) 62%, white)',
  'color-mix(in srgb, var(--scribo-primary) 48%, white)',
  'color-mix(in srgb, var(--scribo-primary) 35%, white)',
] as const;

/** Renderiza texto com **palavra** em cor de destaque (accent Scribo) */
function renderWithHighlights(text: string) {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const match = part.match(/^\*\*(.+)\*\*$/);
    if (match) {
      return (
        <span key={i} className="material-highlight text-primary font-semibold">
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
      return (
        <div className="material-card my-16 py-8 px-6 rounded-xl bg-neutral-cream dark:bg-white border border-slate-200 dark:border-slate-200">
          <p className="text-slate-700 dark:text-[#0a0a0a] text-xs font-display font-bold uppercase tracking-widest text-center mb-6">
            Mapa mental
          </p>
          <div className="flex justify-center mb-6">
            <div className="px-6 py-3.5 rounded-xl bg-primary text-on-primary font-display font-semibold text-center text-base max-w-md">
              {center}
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <div className="w-px h-4 bg-primary/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 hover:border-primary/30 transition-colors"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {i + 1}
                </span>
                <span className="font-material text-slate-800 dark:text-[#0a0a0a] text-sm leading-snug pt-0.5">{item}</span>
              </div>
            ))}
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
      // Sem imagem real: não renderizar placeholder.
      return null;
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
              let acc = 0;
              const stops = values.map((v, i) => {
                const start = (acc / total) * 100;
                acc += v;
                const end = (acc / total) * 100;
                return `${PIE_CHART_COLORS[i % PIE_CHART_COLORS.length]} ${start}% ${end}%`;
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
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_CHART_COLORS[i % PIE_CHART_COLORS.length] }}
                      />
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
  const coverSrc =
    material.coverImageUrl?.trim() || (courseId === 'geral' ? CAPA_PADRAO_VTSD : undefined);
  const hasCoverImage = Boolean(coverSrc);
  const theme = COURSE_THEMES[courseId];
  const isVtsd = courseId === 'geral';
  const lessonNumber = extractLessonNumber(material.title || '');
  const moduleName = material.subtitle?.trim() || theme.name;

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
      {/* Capa — curso VTSD com arte base e só textos variáveis */}
      {isVtsd && hasCoverImage ? (
        <header className="relative min-h-[720px] print:min-h-0 print:break-after-page overflow-hidden cover-page">
          <img src={coverSrc} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 p-8 md:p-10 flex flex-col text-[#202020]">
            <div className="flex items-start justify-between text-[20px] md:text-[26px] font-light tracking-tight">
              <span>{moduleName}</span>
              <span className="text-right leading-tight">
                <span className="block">Aula</span>
                <span className="block font-semibold text-[26px] md:text-[40px]">Nº {lessonNumber}</span>
              </span>
            </div>
            <h1 className="mt-4 text-[36px] md:text-[54px] font-bold leading-[1.05] tracking-tight max-w-[90%]">
              {material.title}
            </h1>
          </div>
        </header>
      ) : (
        <header className="relative min-h-[420px] md:min-h-[480px] print:min-h-0 print:py-8 flex flex-col md:flex-row print:flex-row print:break-after-page overflow-hidden material-viewer-header cover-page bg-book-cream">
          <div className="absolute inset-0 bg-book-cream" aria-hidden />
          <div className="absolute top-0 left-0 w-1.5 md:w-2 h-full bg-book-blue" aria-hidden />
          <CoverPlaceholderIllustration />

          <div className="cover-image-column relative flex-shrink-0 w-full md:w-[42%] min-h-[200px] md:min-h-0 flex items-center justify-center p-6 md:p-10 print:p-4">
            {hasCoverImage ? (
              <div className="cover-image-frame relative w-full max-w-[240px] md:max-w-xs aspect-[4/5] md:aspect-square rounded-sm overflow-hidden shadow-lg border border-book-blue/20 print:shadow-md">
                <img
                  src={coverSrc}
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
      )}

      {/* Página fixa de boas-vindas após a capa (VTSD — mesmo conteúdo que PageIntro / vtsd-fixed-copy) */}
      {isVtsd && (
        <section
          className="relative print:break-after-page overflow-hidden bg-[#025468]"
          style={{ aspectRatio: '595 / 842', minHeight: 'min(100vh, 842px)' }}
        >
          <img
            src={PAGINA_BOAS_VINDAS_VTSD}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            width={595}
            height={842}
          />
          <div className="relative z-10 px-8 py-10 md:px-12 md:py-12 max-w-3xl mx-auto">
            <VtsdWelcomeBody variant="web" />
          </div>
        </section>
      )}

      {/* Sumário — VTSD usa arte base; demais cursos usam layout padrão */}
      {isVtsd ? (
        <nav className="relative print:break-after-page min-h-[720px] overflow-hidden" aria-label="Sumário">
          <img src="/images/sumario-vtsd.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="relative z-10 px-10 md:px-16 pt-44 md:pt-52 pb-16 flex flex-col items-center justify-start">
            <ol className="list-none space-y-3 md:space-y-3.5 w-full max-w-3xl mt-10 md:mt-14">
              {material.sections?.map((section, idx) => {
                const startPage = 4 + idx;
                return (
                  <li
                    key={idx}
                    className="flex w-full items-baseline gap-2 font-display text-base md:text-xl text-[#0c8f8a]"
                  >
                    <span className="font-semibold w-9 shrink-0 text-right tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-semibold min-w-0 shrink leading-snug">{section.title}</span>
                    <span
                      className="flex-1 min-w-[1rem] border-b-2 border-dotted border-[#0c8f8a]/40 mb-1 mx-0.5"
                      aria-hidden
                    />
                    <span className="shrink-0 tabular-nums font-semibold w-8 text-right" aria-label={`Página ${startPage}`}>
                      {startPage}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>
      ) : (
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
      )}

      {/* Conteúdo — mesma largura e ritmo horizontal do sumário (max-w-4xl + padding); faixa lateral = sumário */}
      <div className="material-content book-content book-content-landscape w-full max-w-4xl mx-auto px-8 md:px-16 py-10 md:py-14 print:py-8 print:max-w-none bg-book-cream">
        {material.sections?.map((section, idx) => (
          <section
            key={idx}
            className="mb-16 md:mb-20 last:mb-0 print:break-inside-avoid"
            aria-labelledby={`section-rail-title-${idx}`}
          >
            <div className="book-internal-section-wrap flex flex-col md:flex-row md:items-stretch overflow-hidden rounded-lg border border-slate-200/65 bg-book-cream shadow-sm print:shadow-none">
              <aside
                className="book-section-rail flex flex-row md:flex-col items-center md:items-center justify-center md:justify-start gap-3 md:gap-8 py-5 md:py-10 px-4 md:px-3 md:w-[7rem] lg:w-[7.5rem] shrink-0 border-b md:border-b-0 md:border-r border-white/30"
                aria-label={`Seção ${idx + 1}: ${section.title}`}
              >
                <span
                  className="font-display font-bold tabular-nums text-xl md:text-2xl text-white shrink-0"
                  aria-hidden
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  id={`section-rail-title-${idx}`}
                  className="book-toc-title font-display text-center md:text-left font-bold uppercase tracking-[0.12em] md:tracking-[0.15em] text-[11px] md:text-[9px] leading-snug text-white/95 md:[writing-mode:vertical-rl] md:[text-orientation:mixed] md:rotate-180 md:whitespace-nowrap flex-1 md:flex-none min-w-0 md:max-h-[min(480px,58vh)] md:overflow-y-auto"
                >
                  {section.title}
                </span>
              </aside>
              <div className="book-section-main flex-1 min-w-0 px-5 md:px-10 lg:px-12 py-8 md:py-10 bg-book-cream">
                <div className="book-section-body lg:columns-2 lg:gap-12 space-y-0 text-slate-800">
                  {section.blocks?.map((block, bidx) => (
                    <Block key={bidx} block={block} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Rodapé — estilo livro */}
      <footer className="border-t border-book-blue/30 px-8 md:px-16 py-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-book-cream">
        <p className="text-xs text-slate-600 font-medium tracking-widest uppercase">
          © {new Date().getFullYear()} scribo
        </p>
        <div className="flex gap-8">
          <a className="text-xs text-book-blue hover:underline font-medium uppercase tracking-widest" href="#">Suporte</a>
          <a className="text-xs text-book-blue hover:underline font-medium uppercase tracking-widest" href="#">Políticas</a>
        </div>
      </footer>
    </article>
  );
}
