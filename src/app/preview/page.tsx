'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';
import { PageThumbnail } from '@/components/PageThumbnail';
import { MermaidInit } from '@/components/MermaidInit';
import { ScriboLogo } from '@/components/ScriboLogo';
import { loadPreviewDataFromClient, savePreviewDataToClient } from '@/lib/preview-storage';
import { buildPlainTextFromPreview } from '@/lib/previewPlainText';
import { usePreviewScroll } from '@/hooks/usePreviewScroll';
import { TrainingFeedbackBar } from '@/components/TrainingFeedbackBar';
import { getFromGallery, saveMaterialToGallery } from '@/lib/gallery-storage';

export default function PreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const galleryId = searchParams?.get('galleryId') || null;
  const [data, setData] = useState<PreviewData | null>(null);
  const [regenLoading, setRegenLoading] = useState<null | 'images' | 'all'>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const design = data?.design || data?.conteudo;
  const rawPaginas = design?.paginas ?? (design as { pages?: unknown[] })?.pages;
  const paginas = Array.isArray(rawPaginas) ? rawPaginas : [];

  const { currentPage, scale, userZoom, setUserZoom, scrollToPage } = usePreviewScroll(
    canvasRef,
    pageRefs,
    paginas.length,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Tenta carregar via session ID do servidor (usado pelo Puppeteer e botão PDF)
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session');
      if (sessionId) {
        try {
          const res = await fetch(`/api/pdf-preview-session/${sessionId}`);
          if (res.ok) {
            const json = await res.json();
            if (!cancelled && json) {
              setData(json as PreviewData);
              return;
            }
          }
        } catch {
          /* fallback para localStorage */
        }
      }
      // 2. Fallback: carrega do localStorage/IndexedDB (uso normal do preview)
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

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleRegenerateImages = useCallback(async () => {
    if (!data) return;
    setRegenLoading('images');
    try {
      const res = await fetch('/api/regenerate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewData: data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao regerar imagens' }));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const { previewData } = (await res.json()) as { previewData: PreviewData };
      setData(previewData);
      await savePreviewDataToClient(previewData);
      await saveMaterialToGallery({ previewData });
    } catch (err) {
      console.error('[handleRegenerateImages]', err);
      alert(err instanceof Error ? err.message : 'Erro ao regerar imagens.');
    } finally {
      setRegenLoading(null);
    }
  }, [data]);

  const handleRegenerateAll = useCallback(async () => {
    if (!galleryId || !data) return;
    setRegenLoading('all');
    try {
      const item = await getFromGallery(galleryId);
      if (!item?.originalVtt) {
        alert('VTT original não encontrado para esse material — não é possível regerar tudo.');
        return;
      }
      const vttBlob = new Blob([item.originalVtt], { type: 'text/vtt' });
      const vttFile = new File([vttBlob], 'material.vtt', { type: 'text/vtt' });
      const formData = new FormData();
      formData.append('vtt', vttFile);
      if (item.cursoId) formData.append('curso_id', item.cursoId);
      if (item.modo) formData.append('modo', item.modo);

      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao regerar' }));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const raw = (await res.json()) as Record<string, unknown>;
      const { _pdfId: _omit, ...newData } = raw;
      void _omit;
      setData(newData as PreviewData);
      await savePreviewDataToClient(newData);
      await saveMaterialToGallery({
        previewData: newData,
        originalVtt: item.originalVtt,
        cursoId: item.cursoId,
        modo: item.modo,
      });
    } catch (err) {
      console.error('[handleRegenerateAll]', err);
      alert(err instanceof Error ? err.message : 'Erro ao regerar o material.');
    } finally {
      setRegenLoading(null);
    }
  }, [galleryId, data]);

  const handleDownloadPdf = useCallback(async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const title = (data.conteudo?.titulo || data.design?.titulo || 'material')
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'material';

      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao gerar PDF.' }));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error('[handleDownloadPdf]', err);
      alert(err instanceof Error ? err.message : 'Erro ao gerar PDF. Tente novamente.');
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
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, [data]);

  const isVtsdPreview =
    data?.curso_id === 'geral' ||
    (data?.tema?.name || '').toLowerCase().includes('venda todo santo dia');

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
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#446EFF' }}
          title="Voltar à home pra gerar um novo material"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Gerar novo material
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Barra de zoom flutuante — fica fixa no canto inferior esquerdo da viewport */}
        <div
          className="no-print fixed bottom-24 left-6 z-30 flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#1a1a24]/95"
          aria-label="Controle de zoom do preview"
        >
          <button
            type="button"
            onClick={() => setUserZoom(userZoom - 0.1)}
            disabled={userZoom <= 0.5}
            aria-label="Diminuir zoom"
            title="Diminuir zoom"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40 dark:text-white/80 dark:hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={userZoom}
            onChange={(e) => setUserZoom(Number(e.target.value))}
            className="h-1 w-32 cursor-pointer accent-[#446EFF]"
            aria-label="Slider de zoom"
          />
          <button
            type="button"
            onClick={() => setUserZoom(userZoom + 0.1)}
            disabled={userZoom >= 2}
            aria-label="Aumentar zoom"
            title="Aumentar zoom"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40 dark:text-white/80 dark:hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button
            type="button"
            onClick={() => setUserZoom(1)}
            title="Voltar ao tamanho padrão (100%)"
            className="ml-1 min-w-[44px] rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-white/80 dark:hover:bg-white/10"
          >
            {Math.round(userZoom * 100)}%
          </button>
        </div>

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
        className={`no-print flex shrink-0 flex-col items-center justify-center gap-4 border-t px-4 py-4 ${headerFooterBg}`}
      >
        <TrainingFeedbackBar data={data} isVtsdPreview={isVtsdPreview} />
        <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          style={{ backgroundColor: '#446EFF' }}
        >
          <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
          {pdfLoading ? 'Gerando PDF...' : 'Baixar PDF'}
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
        <button
          type="button"
          onClick={handleRegenerateImages}
          disabled={regenLoading !== null || !data}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-xl border border-white/20 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          style={{ backgroundColor: '#8b5cf6' }}
          title="Mantém texto e layout, gera imagens novas"
        >
          <span className="material-symbols-outlined text-[20px]">image</span>
          {regenLoading === 'images' ? 'Regerando…' : 'Regerar imagens'}
        </button>
        {galleryId && (
          <button
            type="button"
            onClick={handleRegenerateAll}
            disabled={regenLoading !== null || !data}
            className="flex min-w-[10rem] items-center justify-center gap-2 rounded-xl border border-white/20 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
            style={{ backgroundColor: '#d97706' }}
            title="Re-executa o pipeline inteiro com o VTT original"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
            {regenLoading === 'all' ? 'Regerando tudo…' : 'Regerar tudo'}
          </button>
        )}
        </div>
      </footer>
    </div>
  );
}
