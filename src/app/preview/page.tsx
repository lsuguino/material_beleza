'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';
import { MermaidInit } from '@/components/MermaidInit';

const STORAGE_KEY = 'rtg-preview-data';

function buildPlainTextFromPreview(data: PreviewData): string {
  const source = data.conteudo || data.design;
  const titulo = source?.titulo || 'Material';
  const subtitulo = source?.subtitulo_curso || data.tema?.name || '';
  const rawPaginas = source?.paginas ?? (source as { pages?: unknown[] })?.pages;
  const paginas = Array.isArray(rawPaginas) ? rawPaginas as Array<Record<string, unknown>> : [];

  const lines: string[] = [];
  lines.push(titulo);
  if (subtitulo) lines.push(subtitulo);
  lines.push('');

  let section = 0;
  for (const p of paginas) {
    const tipo = String(p.tipo || '');
    if (tipo !== 'conteudo') continue;
    section += 1;
    const heading = String(p.titulo_bloco || p.titulo || `Seção ${section}`);
    lines.push(`## ${heading}`);

    const blocoPrincipal = String(p.bloco_principal || '').trim();
    if (blocoPrincipal) {
      lines.push(blocoPrincipal);
      lines.push('');
    }

    const blocks = Array.isArray(p.content_blocks) ? p.content_blocks as Array<Record<string, unknown>> : [];
    for (const b of blocks) {
      const type = String(b.type || '');
      const content = String(b.content || '').trim();
      if (!content) continue;
      if (type === 'text') lines.push(content);
      if (type === 'chart') lines.push(`[Gráfico sugerido] ${content}`);
      if (type === 'mermaid') lines.push(`[Fluxograma sugerido] ${content}`);
      if (type === 'image') lines.push(`[Imagem sugerida] ${content}`);
    }
    if (blocks.length) lines.push('');

    const destaques = Array.isArray(p.destaques) ? p.destaques as string[] : [];
    if (destaques.length) {
      lines.push('Exemplos citados:');
      for (const d of destaques) lines.push(`- ${d}`);
      lines.push('');
    }

    const citacao = String(p.citacao || '').trim();
    if (citacao) {
      lines.push(`Citação: ${citacao}`);
      lines.push('');
    }
  }

  if (data.perguntas?.length) {
    lines.push('');
    lines.push('Perguntas para reflexão');
    for (const q of data.perguntas) {
      lines.push(`• ${q}`);
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default function PreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
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

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const title = (data.conteudo?.titulo || data.design?.titulo || 'material')
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'material';

      const previewUrl = `${window.location.origin}/preview`;
      const storagePayload: Record<string, string> = {
        [STORAGE_KEY]: JSON.stringify(data),
        'rtg-pdf-mode': '1',
      };

      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: previewUrl, data: storagePayload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao gerar PDF.' }));
        alert(err.error || 'Erro ao gerar PDF.');
        return;
      }

      const blob = await res.blob();
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
      alert('Erro inesperado ao gerar o PDF. Tente novamente.');
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
  }, []);

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

  return (
    <div
      className={`preview-layout flex h-screen overflow-hidden ${isVtsdPreview ? 'bg-[#e6e6e4]' : 'bg-[#2d2d3a]'}`}
    >
      {/* Barra lateral fixa */}
      <aside
        className={`preview-sidebar no-print flex-shrink-0 w-56 border-r flex flex-col p-4 ${
          isVtsdPreview
            ? 'bg-[#f2f2f0] border-black/10 text-neutral-800'
            : 'bg-[#1a1a24] border-white/10'
        }`}
      >
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="w-full py-2.5 rounded-xl font-semibold text-white mb-4 transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#446EFF' }}
        >
          {pdfLoading ? 'Gerando PDF...' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={handleDownloadText}
          className="w-full py-2.5 rounded-xl font-semibold text-white mb-4 transition-opacity hover:opacity-90 border border-white/20"
          style={{ backgroundColor: '#1f8f6f' }}
        >
          Download TXT
        </button>
        <Link
          href="/"
          className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 mb-6 transition-colors ${
            isVtsdPreview
              ? 'text-neutral-800 border border-black/10 hover:bg-black/[0.04]'
              : 'text-white/90 border border-white/20 hover:bg-white/5'
          }`}
        >
          ← Gerar Novo Material
        </Link>
        <p className={`text-sm mb-3 ${isVtsdPreview ? 'text-neutral-600' : 'text-white/60'}`}>
          Página {Math.min(Math.max(1, currentPage), paginas.length || 1)} de {paginas.length || 1}
        </p>
        <div className="flex-1 overflow-auto space-y-2">
          {paginas.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              className={`w-full aspect-[595/842] max-h-24 rounded border-2 overflow-hidden transition-all ${
                currentPage === i + 1
                  ? 'border-[#446EFF] opacity-100'
                  : isVtsdPreview
                    ? 'border-black/15 opacity-80 hover:opacity-100'
                    : 'border-white/20 opacity-70 hover:opacity-90'
              }`}
              style={{ backgroundColor: isVtsdPreview ? '#d8d8d5' : '#2d2d3a' }}
            >
              <span
                className={`text-xs p-1 block text-center ${isVtsdPreview ? 'text-neutral-500' : 'text-white/50'}`}
              >
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Área central: páginas em sequência (Web-to-Print Corporate Editorial) */}
      <div
        ref={canvasRef}
        className={`preview-canvas flex-1 overflow-y-auto overflow-x-hidden p-8 flex flex-col items-center gap-8 min-h-0 print-content ${
          isVtsdPreview ? 'bg-[#e6e6e4]' : ''
        }`}
      >
        <MermaidInit className="flex flex-col items-center gap-8 w-full">
          {paginas.length === 0 ? (
            <div
              className={`rounded-2xl p-12 text-center ${
                isVtsdPreview
                  ? 'bg-white border border-black/10 text-neutral-600'
                  : 'bg-white/5 border border-white/10 text-white/70'
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
                  ref={(el) => { pageRefs.current[index] = el; }}
                  className="preview-page-wrap flex flex-col items-center"
                >
                  {pageNode}
                </div>
              )}
            />
          )}
        </MermaidInit>
      </div>
    </div>
  );
}
