'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';
import { PageThumbnail } from '@/components/PageThumbnail';
import { MermaidInit } from '@/components/MermaidInit';
import { ScriboLogo } from '@/components/ScriboLogo';
import { fetchPdfBlobFromPreviewData } from '@/lib/fetch-pdf-blob';
import { loadPreviewDataFromClient } from '@/lib/preview-storage';
import { buildPlainTextFromPreview } from '@/lib/previewPlainText';

export default function PreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const parsed = await loadPreviewDataFromClient();
      if (cancelled) return;
      if (!parsed) {
        router.replace('/');
        return;
      }
      setData(parsed as PreviewData);
    })();
    return () => {
      cancelled = true;
    };
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

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

  // Verifica periodicamente se o PDF pré-gerado já está pronto
  useEffect(() => {
    const id = typeof window !== 'undefined' ? window.localStorage.getItem('rtg-pdf-id') : null;
    if (!id) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/pdf/${id}?check=1`);
          if (!res.ok) { cancelled = true; return; }
          const json = await res.json() as { ready: boolean; error?: string };
          if (json.ready) { if (!cancelled) setPdfReady(true); return; }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const title = (data.conteudo?.titulo || data.design?.titulo || 'material')
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'material';

      const pdfId = typeof window !== 'undefined' ? window.localStorage.getItem('rtg-pdf-id') : null;

      let blob: Blob;

      if (pdfId) {
        const res = await fetch(`/api/pdf/${pdfId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro ao baixar PDF.' }));
          throw new Error((err as { error?: string }).error || 'Erro ao baixar PDF.');
        }
        blob = await res.blob();
        window.localStorage.removeItem('rtg-pdf-id');
        setPdfReady(false);
      } else {
        const previewUrl = `${window.location.origin}/preview`;
        blob = await fetchPdfBlobFromPreviewData(previewUrl, data);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[handleDownloadPdf]', err);
      alert(err instanceof Error ? err.message : 'Erro inesperado ao gerar o PDF. Tente novamente.');
    } finally {
      setPdfLoading(false);
    }
  }, [data]);

  const handleDownloadText = useCallback(() => {
    if (!data) return;
    const text = buildPlainTextFromPreview(data);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const title = (data.conteudo?.titulo || data.design?.titulo || 'material')
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'material';
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [data]);

  const design = data?.design || data?.conteudo;
  const rawPaginas = design?.paginas ?? (design as { pages?: unknown[] })?.pages;
  const paginas = Array.isArray(rawPaginas) ? rawPaginas : [];
  const isVtsdPreview =
    data?.curso_id === 'geral' ||
    (data?.tema?.name || '').toLowerCase().includes('venda todo santo dia');

  // Responsivo: escala as páginas (595px) para caber no canvas
  useEffect(() => {
    // PDF render mode: always use scale 1 so content is pixel-perfect
    if (typeof window !== 'undefined' && window.localStorage.getItem('rtg-pdf-mode') === '1') {
      setScale(1);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const compute = () => {
      // canvas tem padding p-8 (32px) dos dois lados
      const available = Math.max(280, canvas.clientWidth - 64);
      const next = Math.min(1, available / 595);
      setScale(next);
    };

    compute();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => compute());
      ro.observe(canvas);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [data]);

  // Manter refs alinhados ao número de páginas (após ter paginas definido)
  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, paginas.length);
  }, [paginas.length]);

  if (data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2d2d3a]" role="status" aria-label="Carregando preview">
        <p className="text-white/70">Carregando...</p>
      </div>
    );
  }

  const shellBg = isVtsdPreview ? 'bg-[#e6e6e4]' : 'bg-[#2d2d3a]';
  const headerFooterBg = isVtsdPreview
    ? 'bg-[#f2f2f0] border-black/10 text-neutral-800'
    : 'bg-[#1a1a24] border-white/10 text-white/90';
  const asideBg = isVtsdPreview
    ? 'bg-[#f2f2f0] border-black/10 text-neutral-800'
    : 'bg-[#1a1a24] border-white/10';

  return (
    <div className={`preview-layout flex h-screen min-h-0 flex-col overflow-hidden ${shellBg}`}>
      <header
        className={`no-print flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 sm:px-6 ${headerFooterBg}`}
      >
        <ScriboLogo className="h-6 shrink-0 text-[#1a2dc2] dark:text-[#7B9CFF]" />
        <Link
          href="/"
          className={`text-sm font-medium transition-colors ${
            isVtsdPreview ? 'text-neutral-700 hover:text-neutral-900' : 'text-white/80 hover:text-white'
          }`}
        >
          ← Novo material
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Vista principal: rolagem grande */}
        <div
          ref={canvasRef}
          className={`preview-canvas print-content flex min-h-0 flex-1 flex-col items-center gap-8 overflow-y-auto overflow-x-hidden p-6 sm:p-8 ${
            isVtsdPreview ? 'bg-[#e6e6e4]' : ''
          }`}
        >
          <MermaidInit className="flex w-full flex-col items-center gap-8">
            {paginas.length === 0 ? (
              <div
                className={`rounded-2xl p-12 text-center ${
                  isVtsdPreview
                    ? 'border border-black/10 bg-white text-neutral-600'
                    : 'border border-white/10 bg-white/5 text-white/70'
                }`}
              >
                Nenhuma página no material. Gere um novo material na página inicial.
              </div>
            ) : (
              <MaterialPreviewBlocks
                data={data}
                scale={scale}
                renderPageWrapper={(pageNode, index) => (
                  <div
                    ref={(el) => {
                      pageRefs.current[index] = el;
                    }}
                    className="preview-page-wrap flex flex-col items-center"
                  >
                    {pageNode}
                  </div>
                )}
              />
            )}
          </MermaidInit>
        </div>

        {/* Miniaturas à direita */}
        <aside
          className={`no-print preview-sidebar flex w-full shrink-0 flex-col border-t p-4 lg:w-60 lg:border-l lg:border-t-0 ${asideBg}`}
        >
          <p className={`mb-3 text-sm ${isVtsdPreview ? 'text-neutral-600' : 'text-white/60'}`}>
            Página {Math.min(Math.max(1, currentPage), paginas.length || 1)} de {paginas.length || 1}
          </p>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-2">
              {paginas.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToPage(i)}
                  className={`w-full overflow-hidden rounded border-2 transition-all ${
                    currentPage === i + 1
                      ? 'border-[#446EFF] opacity-100'
                      : isVtsdPreview
                        ? 'border-black/15 opacity-80 hover:opacity-100'
                        : 'border-white/20 opacity-70 hover:opacity-90'
                  }`}
                  style={{ aspectRatio: '595 / 842' }}
                >
                  <PageThumbnail data={data!} pageIndex={i} width={93} height={131} />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <footer
        className={`no-print flex shrink-0 flex-wrap items-center justify-center gap-3 border-t px-4 py-4 ${headerFooterBg}`}
      >
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: '#446EFF' }}
        >
          <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
          {pdfLoading ? 'Aguardando PDF...' : pdfReady ? '⚡ Baixar PDF' : 'Baixar PDF'}
        </button>
        <button
          type="button"
          onClick={handleDownloadText}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-xl border border-white/20 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1f8f6f' }}
        >
          <span className="material-symbols-outlined text-[20px]">article</span>
          Baixar texto pronto
        </button>
      </footer>
    </div>
  );
}
