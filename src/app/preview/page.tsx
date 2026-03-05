'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageCapa } from '@/components/pages/PageCapa';
import { PageConteudo } from '@/components/pages/PageConteudo';
import { PageCitacao } from '@/components/pages/PageCitacao';
import { PageDados } from '@/components/pages/PageDados';

const STORAGE_KEY = 'rtg-preview-data';

interface TemaPreview {
  name: string;
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
}

interface PaginaDesign {
  tipo?: string;
  layout_tipo?: string;
  titulo?: string;
  subtitulo?: string;
  titulo_bloco?: string;
  bloco_principal?: string;
  destaques?: string[];
  citacao?: string;
  dado_numerico?: string;
  cor_fundo_principal?: string;
  cor_fundo_destaque?: string;
  cor_texto_principal?: string;
  cor_texto_destaque?: string;
  proporcao_colunas?: string;
  /** Sugestões visuais da IA de conteúdo (preservadas pelo design) */
  sugestao_imagem?: string;
  prompt_imagem?: string;
  sugestao_grafico?: { tipo: string; titulo: string; labels: string[]; valores: number[] };
  sugestao_fluxograma?: { titulo: string; etapas: string[] };
  sugestao_tabela?: { titulo: string; colunas: string[]; linhas: string[][] };
  sugestao_icone?: string;
  [key: string]: unknown;
}

interface PreviewData {
  conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: PaginaDesign[] };
  design?: { titulo?: string; subtitulo_curso?: string; paginas?: PaginaDesign[] };
  tema?: TemaPreview;
  curso_id?: string;
}

function normalizePaginaConteudo(p: PaginaDesign): PaginaDesign & { paragrafos?: string[] } {
  const paragrafos = p.bloco_principal
    ? p.bloco_principal.split(/\n+/).filter(Boolean)
    : [];
  return {
    ...p,
    titulo: p.titulo ?? p.titulo_bloco,
    paragrafos: paragrafos.length > 0 ? paragrafos : (p.bloco_principal ? [p.bloco_principal] : []),
    layout_tipo: (p.layout_tipo as string) || 'header_destaque',
    cor_fundo_principal: p.cor_fundo_principal ?? '#f8fafc',
    cor_fundo_destaque: p.cor_fundo_destaque ?? '#e2e8f0',
    cor_texto_principal: p.cor_texto_principal ?? '#0f172a',
    cor_texto_destaque: p.cor_texto_destaque ?? '#1e40af',
    icone_sugerido: (p.icone_sugerido as string) || 'article',
  };
}

export default function PreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      router.replace('/');
      return;
    }
    try {
      setData(JSON.parse(raw) as PreviewData);
    } catch {
      router.replace('/');
    }
  }, [router]);

  const handleScroll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scrollTop = canvas.scrollTop;
    const children = canvas.querySelectorAll('.preview-page-wrap');
    let index = 0;
    children.forEach((el, i) => {
      const top = (el as HTMLElement).offsetTop;
      const height = (el as HTMLElement).offsetHeight;
      if (scrollTop >= top - height / 2) index = i + 1;
    });
    setCurrentPage(index);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    handleScroll();
    canvas.addEventListener('scroll', handleScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', handleScroll);
  }, [data, handleScroll]);

  const scrollToPage = useCallback((index: number) => {
    pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a24]">
        <p className="text-white/70">Carregando...</p>
      </div>
    );
  }

  const design = data.design || data.conteudo;
  const tema = data.tema || { name: 'Curso', primary: '#446EFF', primaryLight: '#6B8CFF', primaryDark: '#2d5aff', accent: '#446EFF' };
  const paginas = design?.paginas || [];
  const nomeCurso = tema.name || (design as { subtitulo_curso?: string })?.subtitulo_curso || 'Material';
  const tituloGeral = design?.titulo || 'Material gerado';
  const cursoId = data.curso_id;

  return (
    <div className="preview-layout flex h-screen bg-[#2d2d3a] overflow-hidden">
      {/* Barra lateral fixa */}
      <aside className="preview-sidebar flex-shrink-0 w-56 bg-[#1a1a24] border-r border-white/10 flex flex-col p-4">
        <button
          type="button"
          onClick={handlePrint}
          className="w-full py-2.5 rounded-xl font-semibold text-white mb-4 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#446EFF' }}
        >
          Download PDF
        </button>
        <Link
          href="/"
          className="w-full py-2.5 rounded-xl font-medium text-white/90 border border-white/20 flex items-center justify-center gap-2 mb-6 hover:bg-white/5 transition-colors"
        >
          ← Gerar Novo Material
        </Link>
        <p className="text-white/60 text-sm mb-3">Página {currentPage} de {paginas.length || 1}</p>
        <div className="flex-1 overflow-auto space-y-2">
          {paginas.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              className={`w-full aspect-[595/842] max-h-24 rounded border-2 overflow-hidden transition-all ${
                currentPage === i + 1 ? 'border-[#446EFF] opacity-100' : 'border-white/20 opacity-70 hover:opacity-90'
              }`}
              style={{ backgroundColor: '#2d2d3a' }}
            >
              <span className="text-white/50 text-xs p-1 block text-center">{i + 1}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Área central: páginas em sequência vertical */}
      <div
        ref={canvasRef}
        className="preview-canvas flex-1 overflow-y-auto overflow-x-hidden p-8 flex flex-col items-center gap-8 min-h-0"
      >
        {paginas.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center text-white/70">
            Nenhuma página no material. Gere um novo material na página inicial.
          </div>
        ) : (
          paginas.map((pagina, index) => {
            const numPagina = index + 1;
            const tipo = pagina.tipo || 'conteudo';
            const layoutTipo = pagina.layout_tipo as string | undefined;

            const wrap = (node: React.ReactNode) => (
              <div
                key={index}
                ref={(el) => { pageRefs.current[index] = el; }}
                className="preview-page-wrap flex flex-col items-center"
              >
                <div className="shadow-2xl rounded-sm overflow-hidden">
                  {node}
                </div>
              </div>
            );

            if (tipo === 'capa') {
              return wrap(
                <PageCapa
                  titulo={pagina.titulo || tituloGeral}
                  subtitulo={pagina.subtitulo}
                  nomeCurso={nomeCurso}
                  tema={tema}
                  cursoId={cursoId}
                />
              );
            }

            if (layoutTipo === 'citacao_grande' && (pagina.citacao || pagina.bloco_principal)) {
              return wrap(
                <PageCitacao
                  citacao={pagina.citacao || pagina.bloco_principal || ''}
                  autor={pagina.autor as string | undefined}
                  tema={tema}
                  numeroPagina={numPagina}
                  nomeCurso={nomeCurso}
                />
              );
            }

            if (pagina.dado_numerico != null && pagina.bloco_principal) {
              return wrap(
                <PageDados
                  dado_numerico={pagina.dado_numerico}
                  contexto={pagina.bloco_principal}
                  destaques={pagina.destaques || []}
                  tema={tema}
                  numeroPagina={numPagina}
                  nomeCurso={nomeCurso}
                />
              );
            }

            const paginaNorm = normalizePaginaConteudo(pagina);
            return wrap(
              <PageConteudo
                pagina={paginaNorm as Parameters<typeof PageConteudo>[0]['pagina']}
                tema={tema}
                numeroPagina={numPagina}
                nomeCurso={nomeCurso}
              />
            );
          })
        )}
      </div>

    </div>
  );
}
