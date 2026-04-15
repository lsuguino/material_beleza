'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';
import { PageThumbnail } from '@/components/PageThumbnail';
import { MermaidInit } from '@/components/MermaidInit';
import { usePreviewScroll } from '@/hooks/usePreviewScroll';
import { savePreviewDataToClient } from '@/lib/preview-storage';
import { VTSD_COLOR } from '@/lib/vtsd-design-system';

interface InlinePreviewProps {
  data: PreviewData;
  onClose: () => void;
  onDownloadPdf: () => void;
  onDownloadText: () => void;
  pdfLoading: boolean;
  file: File | null;
  cursoId: string;
  modo: string;
  onDataUpdate: (data: PreviewData) => void;
}

const NON_REGENERABLE_TYPES = new Set(['capa', 'contracapa', 'sumario_ref', 'sumario', 'intro_ref', 'conclusao_ref']);

type LayoutOptionItem = { value: string; label: string; icon: string };

/** Catálogo completo de layouts no editor (filtrado por tipo de página abaixo). */
const LAYOUT_OPTIONS_ALL: LayoutOptionItem[] = [
  { value: 'A4_2_conteudo_misto', label: 'Misto', icon: 'dashboard' },
  { value: 'A4_2_texto_corrido', label: 'Texto', icon: 'article' },
  { value: 'A4_2_texto_citacao', label: 'Citação', icon: 'format_quote' },
  { value: 'A4_2_texto_sidebar', label: 'Sidebar', icon: 'side_navigation' },
  { value: 'A4_3_sidebar_steps', label: 'Etapas', icon: 'format_list_numbered' },
  { value: 'A4_4_magazine', label: 'Magazine', icon: 'auto_stories' },
  { value: 'A4_7_sidebar_conteudo', label: 'Conteúdo', icon: 'view_sidebar' },
  { value: 'A4_1_abertura', label: 'Abertura', icon: 'title' },
];

/** Miolo: tudo exceto abertura de capítulo. */
const LAYOUT_IDS_MIOLO = new Set(
  LAYOUT_OPTIONS_ALL.filter((o) => !o.value.startsWith('A4_1_')).map((o) => o.value)
);

/** Atividades finais: leitura e blocos compatíveis com perguntas (sem abertura nem etapas pesadas). */
const LAYOUT_IDS_ATIVIDADES = new Set([
  'A4_2_texto_corrido',
  'A4_2_conteudo_misto',
  'A4_2_texto_citacao',
  'A4_2_texto_sidebar',
  'A4_4_magazine',
  'A4_7_sidebar_conteudo',
]);

/**
 * Opções de design permitidas para o tipo de página (abertura ≠ miolo ≠ atividades).
 */
function layoutOptionsForPageTipo(pagina: Record<string, unknown> | null): LayoutOptionItem[] {
  if (!pagina) return LAYOUT_OPTIONS_ALL;
  const tipo = String(pagina.tipo || 'conteudo');
  if (tipo === 'intro_ref') {
    return LAYOUT_OPTIONS_ALL.filter((o) => o.value.startsWith('A4_1_'));
  }
  if (tipo === 'atividades_finais') {
    return LAYOUT_OPTIONS_ALL.filter((o) => LAYOUT_IDS_ATIVIDADES.has(o.value));
  }
  if (tipo === 'conteudo') {
    return LAYOUT_OPTIONS_ALL.filter((o) => LAYOUT_IDS_MIOLO.has(o.value));
  }
  return LAYOUT_OPTIONS_ALL.filter((o) => LAYOUT_IDS_MIOLO.has(o.value));
}

/** Se o layout atual não está no grupo (dados antigos), mantém visível para o usuário trocar. */
function withCurrentLayoutInOptions(
  options: LayoutOptionItem[],
  currentLayout: string
): LayoutOptionItem[] {
  if (!currentLayout || options.some((o) => o.value === currentLayout)) return options;
  const extra = LAYOUT_OPTIONS_ALL.find((o) => o.value === currentLayout);
  if (!extra) return options;
  return [extra, ...options];
}

function layoutEditorSubtitle(tipo: string | undefined): string {
  switch (tipo) {
    case 'intro_ref':
      return 'Abertura de capítulo — só modelos de abertura';
    case 'atividades_finais':
      return 'Página de atividades — modelos para perguntas e reflexão';
    case 'conteudo':
      return 'Miolo — modelos de conteúdo (sem abertura de capítulo)';
    default:
      return 'Modelos compatíveis com este tipo de página';
  }
}

/** Layouts que suportam imagem, com descrição da posição visual */
const IMAGE_POSITION_OPTIONS: Array<{ layout: string; label: string; icon: string; description: string }> = [
  { layout: 'A4_1_abertura', label: 'Topo', icon: 'vertical_align_top', description: 'Imagem grande no topo da página' },
  { layout: 'A4_4_magazine', label: 'Esquerda', icon: 'align_horizontal_left', description: 'Imagem na coluna esquerda, texto à direita' },
  { layout: 'A4_2_conteudo_misto', label: 'Direita', icon: 'align_horizontal_right', description: 'Imagem pequena à direita do texto' },
  { layout: 'imagem_lateral', label: 'Lateral', icon: 'view_column', description: 'Imagem lateral (50%), texto ao lado' },
];

export function InlinePreview({
  data,
  onClose,
  onDownloadPdf,
  onDownloadText,
  pdfLoading,
  file,
  cursoId,
  modo,
  onDataUpdate,
}: InlinePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const design = data.design || data.conteudo;
  const rawPaginas = design?.paginas ?? (design as { pages?: unknown[] })?.pages;
  const paginas = Array.isArray(rawPaginas) ? (rawPaginas as Array<Record<string, unknown>>) : [];

  const isVtsd =
    data.curso_id === 'geral' ||
    (data.tema?.name || '').toLowerCase().includes('venda todo santo dia');

  const { currentPage, scale, scrollToPage } = usePreviewScroll(canvasRef, pageRefs, paginas.length);

  // --- Selection & editing state ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingPages, setRegeneratingPages] = useState<Set<number>>(new Set());
  const [editInstruction, setEditInstruction] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showImagePanel, setShowImagePanel] = useState(false);

  const togglePageSelection = useCallback((index: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setEditInstruction('');
    setShowImagePanel(false);
  }, []);

  const canSelectPage = useCallback(
    (index: number) => {
      if (index >= paginas.length) return false;
      const tipo = (paginas[index] as Record<string, unknown>)?.tipo as string | undefined;
      return !NON_REGENERABLE_TYPES.has(tipo || 'conteudo');
    },
    [paginas],
  );

  // Helper to update data and save
  const applyUpdate = useCallback(
    async (updated: PreviewData) => {
      onDataUpdate(updated);
      await savePreviewDataToClient(updated);
    },
    [onDataUpdate],
  );

  // --- Multi-page reorganize ---
  const handleReorganize = useCallback(async () => {
    if (selectedPages.size === 0) return;
    setRegenerating(true);
    setRegeneratingPages(new Set(selectedPages));
    try {
      const transcription = file ? await file.text() : undefined;
      const res = await fetch('/api/regenerate-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingData: data,
          pageIndices: Array.from(selectedPages),
          curso_id: cursoId,
          modo,
          transcription,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao reorganizar.' }));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const updated = (await res.json()) as PreviewData;
      await applyUpdate(updated);
      setSelectedPages(new Set());
      setSelectionMode(false);
    } catch (err) {
      console.error('[handleReorganize]', err);
      alert(err instanceof Error ? err.message : 'Erro ao reorganizar.');
    } finally {
      setRegenerating(false);
      setRegeneratingPages(new Set());
    }
  }, [selectedPages, data, file, cursoId, modo, applyUpdate]);

  // --- Single-page: apply text instruction ---
  const handleEditInstruction = useCallback(async () => {
    if (selectedPages.size !== 1 || !editInstruction.trim()) return;
    const pageIndex = Array.from(selectedPages)[0];
    setActionLoading('edit');
    setRegeneratingPages(new Set([pageIndex]));
    try {
      const transcription = file ? await file.text() : undefined;
      const res = await fetch('/api/edit-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingData: data,
          pageIndex,
          instruction: editInstruction.trim(),
          modo,
          transcription,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao editar.' }));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const updated = (await res.json()) as PreviewData;
      await applyUpdate(updated);
      setEditInstruction('');
    } catch (err) {
      console.error('[handleEditInstruction]', err);
      alert(err instanceof Error ? err.message : 'Erro ao editar página.');
    } finally {
      setActionLoading(null);
      setRegeneratingPages(new Set());
    }
  }, [selectedPages, editInstruction, data, file, modo, applyUpdate]);

  // --- Single-page: change layout (client-side) ---
  const handleChangeLayout = useCallback(
    async (newLayout: string) => {
      if (selectedPages.size !== 1) return;
      const pageIndex = Array.from(selectedPages)[0];

      const dd = data.design || data.conteudo;
      if (!dd?.paginas) return;

      const newPaginas = [...dd.paginas];
      const designFields = isVtsd
        ? {
            layout_tipo: newLayout,
            cor_fundo_principal: VTSD_COLOR.fundo_page,
            cor_fundo_destaque: VTSD_COLOR.primary_darker,
            cor_texto_principal: VTSD_COLOR.texto_800,
            cor_texto_destaque: '#FFFFFF',
          }
        : { layout_tipo: newLayout };

      newPaginas[pageIndex] = { ...newPaginas[pageIndex], ...designFields };

      const cd = data.conteudo;
      const newConteudoPaginas = cd?.paginas ? [...cd.paginas] : null;
      if (newConteudoPaginas && pageIndex < newConteudoPaginas.length) {
        newConteudoPaginas[pageIndex] = { ...newConteudoPaginas[pageIndex], ...designFields };
      }

      const updated: PreviewData = {
        ...data,
        design: dd ? { ...dd, paginas: newPaginas } : undefined,
        conteudo: cd ? { ...cd, paginas: newConteudoPaginas || newPaginas } : undefined,
      };
      await applyUpdate(updated);
    },
    [selectedPages, data, isVtsd, applyUpdate],
  );

  // --- Single-page: image generate/regenerate with position ---
  const handleImageWithPosition = useCallback(
    async (action: 'generate' | 'regenerate', targetLayout: string) => {
      if (selectedPages.size !== 1) return;
      const pageIndex = Array.from(selectedPages)[0];
      setActionLoading('image');
      setRegeneratingPages(new Set([pageIndex]));
      try {
        // First, change layout to the target position layout
        await handleChangeLayout(targetLayout);

        // Then generate/regenerate the image
        // We need to read the latest data after layout change
        const currentDesign = data.design || data.conteudo;
        const currentPaginas = currentDesign?.paginas ? [...currentDesign.paginas] : [];
        if (pageIndex < currentPaginas.length) {
          currentPaginas[pageIndex] = { ...currentPaginas[pageIndex], layout_tipo: targetLayout };
        }
        const dataWithLayout: PreviewData = {
          ...data,
          design: currentDesign ? { ...currentDesign, paginas: currentPaginas } : undefined,
          conteudo: data.conteudo ? { ...data.conteudo, paginas: currentPaginas } : undefined,
        };

        const res = await fetch('/api/page-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            existingData: dataWithLayout,
            pageIndex,
            action,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro ao gerar imagem.' }));
          throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
        }
        const updated = (await res.json()) as PreviewData;
        await applyUpdate(updated);
        setShowImagePanel(false);
      } catch (err) {
        console.error('[handleImageWithPosition]', err);
        alert(err instanceof Error ? err.message : 'Erro ao gerar imagem.');
      } finally {
        setActionLoading(null);
        setRegeneratingPages(new Set());
      }
    },
    [selectedPages, data, handleChangeLayout, applyUpdate],
  );

  // --- Single-page: remove image ---
  const handleRemoveImage = useCallback(async () => {
    if (selectedPages.size !== 1) return;
    const pageIndex = Array.from(selectedPages)[0];
    const designData = data.design || data.conteudo;
    if (!designData?.paginas) return;

    const newPaginas = [...designData.paginas];
    const page = { ...newPaginas[pageIndex] };
    delete page.imagem_url;
    delete page.sugestao_imagem;
    delete page.prompt_imagem;
    newPaginas[pageIndex] = page;

    const newConteudo = data.conteudo?.paginas ? [...data.conteudo.paginas] : null;
    if (newConteudo && pageIndex < newConteudo.length) {
      const cp = { ...newConteudo[pageIndex] };
      delete cp.imagem_url;
      delete cp.sugestao_imagem;
      delete cp.prompt_imagem;
      newConteudo[pageIndex] = cp;
    }

    const updated: PreviewData = {
      ...data,
      design: designData ? { ...designData, paginas: newPaginas } : undefined,
      conteudo: data.conteudo ? { ...data.conteudo, paginas: newConteudo || newPaginas } : undefined,
    };
    await applyUpdate(updated);
  }, [selectedPages, data, applyUpdate]);

  // --- Single-page: resize image dimensions ---
  const handleResizeImage = useCallback(
    async (dimension: 'width' | 'height', value: number) => {
      if (selectedPages.size !== 1) return;
      const pageIndex = Array.from(selectedPages)[0];
      const dd = data.design || data.conteudo;
      if (!dd?.paginas) return;

      const field = dimension === 'width' ? 'imagem_width' : 'imagem_height';
      const newPaginas = [...dd.paginas];
      newPaginas[pageIndex] = { ...newPaginas[pageIndex], [field]: value };

      const cd = data.conteudo;
      const newConteudo = cd?.paginas ? [...cd.paginas] : null;
      if (newConteudo && pageIndex < newConteudo.length) {
        newConteudo[pageIndex] = { ...newConteudo[pageIndex], [field]: value };
      }

      const updated: PreviewData = {
        ...data,
        design: dd ? { ...dd, paginas: newPaginas } : undefined,
        conteudo: cd ? { ...cd, paginas: newConteudo || newPaginas } : undefined,
      };
      await applyUpdate(updated);
    },
    [selectedPages, data, applyUpdate],
  );

  // --- Derived state for single-page editor ---
  const isSingleSelected = selectionMode && selectedPages.size === 1;
  const selectedPageIndex = isSingleSelected ? Array.from(selectedPages)[0] : -1;

  useEffect(() => {
    if (!selectionMode || selectedPageIndex < 0) return;
    const root = thumbStripRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-thumb-index="${selectedPageIndex}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [selectionMode, selectedPageIndex]);
  const selectedPageData = selectedPageIndex >= 0 ? paginas[selectedPageIndex] : null;
  const selectedPageHasImage = selectedPageData
    ? !!(selectedPageData.imagem_url)
    : false;
  const selectedPageCurrentLayout = selectedPageData
    ? (selectedPageData.layout_tipo as string) || 'A4_2_conteudo_misto'
    : '';

  const layoutOptionsForEditor = React.useMemo(() => {
    if (!selectedPageData) return LAYOUT_OPTIONS_ALL;
    const base = layoutOptionsForPageTipo(selectedPageData);
    return withCurrentLayoutInOptions(base, selectedPageCurrentLayout);
  }, [selectedPageData, selectedPageCurrentLayout]);

  const imagePositionOptionsForPage = React.useMemo(() => {
    if (!selectedPageData) return IMAGE_POSITION_OPTIONS;
    const tipo = String(selectedPageData.tipo || 'conteudo');
    if (tipo === 'intro_ref') {
      return IMAGE_POSITION_OPTIONS.filter((o) => o.layout === 'A4_1_abertura');
    }
    if (tipo === 'atividades_finais') {
      return IMAGE_POSITION_OPTIONS.filter((o) => o.layout !== 'A4_1_abertura');
    }
    return IMAGE_POSITION_OPTIONS.filter((o) => o.layout !== 'A4_1_abertura');
  }, [selectedPageData]);

  // Collect all unique images used in the material for gallery reuse
  const materialImages = React.useMemo(() => {
    const imgs: Array<{ url: string; pageIndex: number; titulo: string }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < paginas.length; i++) {
      const url = paginas[i].imagem_url as string | undefined;
      if (url && typeof url === 'string' && url.length > 20 && !seen.has(url)) {
        seen.add(url);
        imgs.push({ url, pageIndex: i, titulo: String(paginas[i].titulo_bloco ?? `Página ${i + 1}`) });
      }
    }
    return imgs;
  }, [paginas]);

  // --- Single-page: apply existing image from gallery ---
  const handleApplyGalleryImage = useCallback(
    async (imageUrl: string, targetLayout: string) => {
      if (selectedPages.size !== 1) return;
      const pageIndex = Array.from(selectedPages)[0];

      const dd = data.design || data.conteudo;
      if (!dd?.paginas) return;

      const designFields = isVtsd
        ? {
            layout_tipo: targetLayout,
            cor_fundo_principal: VTSD_COLOR.fundo_page,
            cor_fundo_destaque: VTSD_COLOR.primary_darker,
            cor_texto_principal: VTSD_COLOR.texto_800,
            cor_texto_destaque: '#FFFFFF',
          }
        : { layout_tipo: targetLayout };

      const newPaginas = [...dd.paginas];
      newPaginas[pageIndex] = {
        ...newPaginas[pageIndex],
        ...designFields,
        imagem_url: imageUrl,
        sugestao_imagem: newPaginas[pageIndex].sugestao_imagem || 'imagem reutilizada',
      };

      const cd = data.conteudo;
      const newConteudo = cd?.paginas ? [...cd.paginas] : null;
      if (newConteudo && pageIndex < newConteudo.length) {
        newConteudo[pageIndex] = {
          ...newConteudo[pageIndex],
          ...designFields,
          imagem_url: imageUrl,
          sugestao_imagem: newConteudo[pageIndex].sugestao_imagem || 'imagem reutilizada',
        };
      }

      const updated: PreviewData = {
        ...data,
        design: dd ? { ...dd, paginas: newPaginas } : undefined,
        conteudo: cd ? { ...cd, paginas: newConteudo || newPaginas } : undefined,
      };
      await applyUpdate(updated);
      setShowImagePanel(false);
    },
    [selectedPages, data, isVtsd, applyUpdate],
  );

  const title = data.conteudo?.titulo || data.design?.titulo || 'Material gerado';

  const shellBg = isVtsd ? 'bg-[#e6e6e4]' : 'bg-[#2d2d3a]';
  const asideBg = isVtsd
    ? 'bg-[#f2f2f0] border-black/10 text-neutral-800'
    : 'bg-[#1a1a24] border-white/10';
  const toolbarBg = isVtsd
    ? 'bg-[#f2f2f0] border-black/10 text-neutral-800'
    : 'bg-[#1a1a24] border-white/10 text-white/90';
  const textMuted = isVtsd ? 'text-neutral-500' : 'text-white/50';
  const textNormal = isVtsd ? 'text-neutral-700' : 'text-white/80';
  const btnSecondary = isVtsd
    ? 'bg-black/5 text-neutral-700 hover:bg-black/10 border-black/10'
    : 'bg-white/10 text-white/80 hover:bg-white/15 border-white/10';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-outline-variant/30 dark:border-outline-variant/35">
      {/* Toolbar */}
      <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 ${toolbarBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              isVtsd ? 'text-neutral-700 hover:bg-black/5' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Voltar
          </button>
          <span className={`truncate text-sm font-semibold ${isVtsd ? 'text-neutral-800' : 'text-white'}`}>
            {title}
          </span>
          <span className={`text-xs ${textMuted}`}>
            {paginas.length} página{paginas.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: '#446EFF' }}
          >
            <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
            {pdfLoading ? 'Gerando...' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={onDownloadText}
            className="flex items-center gap-1 rounded-full border border-[#1f8f6f]/40 bg-[#1f8f6f]/15 px-3 py-1.5 text-xs font-semibold text-[#1a6b55] dark:text-emerald-300"
          >
            <span className="material-symbols-outlined text-[14px]">article</span>
            TXT
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className={`preview-canvas flex min-h-0 flex-1 flex-col items-center gap-8 overflow-y-auto overflow-x-hidden p-6 sm:p-8 ${shellBg}`}
        >
          <MermaidInit className="flex w-full flex-col items-center gap-8">
            {paginas.length === 0 ? (
              <div className={`rounded-2xl p-12 text-center ${isVtsd ? 'border border-black/10 bg-white text-neutral-600' : 'border border-white/10 bg-white/5 text-white/70'}`}>
                Nenhuma página no material.
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

        {/* Sidebar: miniaturas ocupam o espaço vertical disponível; painel de edição fica abaixo com rolagem própria */}
        <aside
          className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t p-4 lg:h-full lg:max-h-full lg:w-72 lg:border-l lg:border-t-0 ${asideBg}`}
        >
          {/* Header: page counter + selection toggle */}
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <p className={`text-sm ${textMuted}`}>
              Página {Math.min(Math.max(1, currentPage), paginas.length || 1)} de {paginas.length || 1}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectionMode((v) => !v);
                if (selectionMode) { setSelectedPages(new Set()); setEditInstruction(''); }
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                selectionMode ? 'bg-primary text-white' : isVtsd ? 'bg-black/5 text-neutral-600 hover:bg-black/10' : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              {selectionMode ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {/* Thumbnail grid — com edição ativa, expande para a folha selecionada ficar visível */}
          <div
            ref={thumbStripRef}
            className={`min-h-0 flex-1 basis-0 overflow-y-auto ${
              isSingleSelected ? 'min-h-[min(42vh,320px)]' : ''
            }`}
          >
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-2">
              {paginas.map((_, i) => {
                const isSelected = selectedPages.has(i);
                const isRegen = regeneratingPages.has(i);
                const selectable = canSelectPage(i);
                return (
                  <button
                    key={i}
                    data-thumb-index={i}
                    type="button"
                    onClick={() => {
                      if (selectionMode && selectable) togglePageSelection(i);
                      else scrollToPage(i);
                    }}
                    className={`relative w-full overflow-hidden rounded border-2 transition-all ${
                      selectionMode && isSelected
                        ? 'border-primary ring-2 ring-primary/30 opacity-100'
                        : currentPage === i + 1
                          ? 'border-[#446EFF] opacity-100'
                          : isVtsd ? 'border-black/15 opacity-80 hover:opacity-100' : 'border-white/20 opacity-70 hover:opacity-90'
                    } ${selectionMode && !selectable ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{ aspectRatio: '595 / 842' }}
                    disabled={selectionMode && !selectable}
                  >
                    <PageThumbnail data={data} pageIndex={i} width={93} height={131} />
                    {selectionMode && selectable && (
                      <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-black/30 shadow">
                        {isSelected && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                      </div>
                    )}
                    {isRegen && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ Single-page editing panel (abaixo das miniaturas; rolagem interna se precisar) ═══ */}
          {isSingleSelected && selectedPageData && (
            <div className="mt-3 flex max-h-[min(52vh,580px)] min-h-0 shrink-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden border-t border-current/10 pt-3 [scrollbar-gutter:stable]">
              <p className={`text-xs font-semibold ${textNormal}`}>
                Página {selectedPageIndex + 1}: {String(selectedPageData.titulo_bloco ?? '')}
              </p>

              {/* Text instruction */}
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="Descreva a alteração desejada..."
                  rows={3}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-xs leading-relaxed placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary ${
                    isVtsd
                      ? 'border-black/15 bg-white text-neutral-800'
                      : 'border-white/15 bg-white/5 text-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleEditInstruction}
                  disabled={!editInstruction.trim() || actionLoading === 'edit'}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading === 'edit' ? (
                    <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Aplicando...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[14px]">edit_note</span> Aplicar alteração</>
                  )}
                </button>
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleReorganize}
                  disabled={!!actionLoading}
                  className={`flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${btnSecondary}`}
                >
                  <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                  Reorganizar página
                </button>

                {/* Image toggle button */}
                <button
                  type="button"
                  onClick={() => setShowImagePanel((v) => !v)}
                  disabled={!!actionLoading}
                  className={`flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    showImagePanel ? 'border-primary bg-primary/10 text-primary' : btnSecondary
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {selectedPageHasImage ? 'image' : 'add_photo_alternate'}
                  </span>
                  {selectedPageHasImage ? 'Imagem' : 'Adicionar imagem'}
                  <span className={`material-symbols-outlined ml-auto text-[14px] transition-transform ${showImagePanel ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {/* Image position panel */}
                {showImagePanel && (
                  <div className={`rounded-lg border p-2.5 ${isVtsd ? 'border-black/10 bg-white/60' : 'border-white/10 bg-white/5'}`}>
                    <p className={`mb-2 text-[11px] font-semibold ${textMuted}`}>
                      {selectedPageHasImage ? 'Posição da imagem' : 'Onde adicionar a imagem?'}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {imagePositionOptionsForPage.map((pos) => (
                        <button
                          key={pos.layout}
                          type="button"
                          onClick={() => handleImageWithPosition(
                            selectedPageHasImage ? 'regenerate' : 'generate',
                            pos.layout,
                          )}
                          disabled={!!actionLoading}
                          title={pos.description}
                          className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all disabled:opacity-50 ${
                            selectedPageCurrentLayout === pos.layout
                              ? 'border-primary bg-primary/10'
                              : isVtsd
                                ? 'border-black/10 hover:border-black/20 hover:bg-black/5'
                                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          {actionLoading === 'image' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <span className={`material-symbols-outlined text-[18px] ${
                              selectedPageCurrentLayout === pos.layout ? 'text-primary' : textMuted
                            }`}>
                              {pos.icon}
                            </span>
                          )}
                          <span className={`text-[10px] leading-tight ${
                            selectedPageCurrentLayout === pos.layout ? 'text-primary font-bold' : textNormal
                          }`}>
                            {pos.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    {/* Resize sliders (only when image exists) */}
                    {selectedPageHasImage && (() => {
                      // Default dimensions per layout
                      const defaults: Record<string, { w: number; h: number; maxW: number; maxH: number }> = {
                        'A4_1_abertura': { w: 595, h: 340, maxW: 595, maxH: 500 },
                        'A4_4_magazine': { w: 308, h: 500, maxW: 500, maxH: 700 },
                        'A4_2_conteudo_misto': { w: 180, h: 140, maxW: 350, maxH: 300 },
                      };
                      const d = defaults[selectedPageCurrentLayout] || { w: 200, h: 160, maxW: 400, maxH: 400 };
                      const currentW = (selectedPageData?.imagem_width as number) || d.w;
                      const currentH = (selectedPageData?.imagem_height as number) || d.h;
                      const sliderBg = isVtsd ? 'accent-neutral-600' : 'accent-white';
                      return (
                        <div className="mt-2 flex flex-col gap-2">
                          <p className={`text-[11px] font-semibold ${textMuted}`}>Tamanho da imagem</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] w-9 ${textMuted}`}>Larg.</span>
                            <input
                              type="range"
                              min={80}
                              max={d.maxW}
                              value={currentW}
                              onChange={(e) => handleResizeImage('width', Number(e.target.value))}
                              className={`flex-1 h-1 rounded-full cursor-pointer ${sliderBg}`}
                            />
                            <span className={`text-[10px] w-8 text-right ${textMuted}`}>{currentW}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] w-9 ${textMuted}`}>Alt.</span>
                            <input
                              type="range"
                              min={60}
                              max={d.maxH}
                              value={currentH}
                              onChange={(e) => handleResizeImage('height', Number(e.target.value))}
                              className={`flex-1 h-1 rounded-full cursor-pointer ${sliderBg}`}
                            />
                            <span className={`text-[10px] w-8 text-right ${textMuted}`}>{currentH}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Gallery: reuse existing images */}
                    {materialImages.length > 0 && (
                      <div className="mt-2">
                        <p className={`mb-1.5 text-[11px] font-semibold ${textMuted}`}>Imagens do material</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {materialImages.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleApplyGalleryImage(img.url, selectedPageCurrentLayout)}
                              disabled={!!actionLoading}
                              title={`Reutilizar: ${img.titulo}`}
                              className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all disabled:opacity-50 ${
                                selectedPageData?.imagem_url === img.url
                                  ? 'border-primary ring-1 ring-primary/30'
                                  : isVtsd
                                    ? 'border-black/10 hover:border-black/25'
                                    : 'border-white/15 hover:border-white/30'
                              }`}
                              style={{ width: 52, height: 52 }}
                            >
                              <img
                                src={img.url}
                                alt={img.titulo}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPageHasImage && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={!!actionLoading}
                        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-red-300/40 px-2 py-1.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:border-red-400/30 dark:text-red-400"
                      >
                        <span className="material-symbols-outlined text-[13px]">delete</span>
                        Remover imagem
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Layout selector — filtrado pelo tipo da página (miolo / abertura / atividades) */}
              <div>
                <p className={`mb-1.5 text-[11px] font-semibold ${textMuted}`}>Design da página</p>
                {selectedPageData ? (
                  <p className={`mb-2 text-[10px] leading-snug ${textMuted}`}>
                    {layoutEditorSubtitle(selectedPageData.tipo as string | undefined)}
                  </p>
                ) : null}
                <div className="grid grid-cols-4 gap-1">
                  {layoutOptionsForEditor.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChangeLayout(opt.value)}
                      disabled={!!actionLoading}
                      title={opt.label}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-center transition-all disabled:opacity-50 ${
                        selectedPageCurrentLayout === opt.value
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : isVtsd
                            ? 'border-black/10 hover:border-black/20 hover:bg-black/5'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[16px] ${selectedPageCurrentLayout === opt.value ? 'text-primary' : textMuted}`}>
                        {opt.icon}
                      </span>
                      <span className={`text-[9px] leading-tight ${selectedPageCurrentLayout === opt.value ? 'text-primary font-bold' : textMuted}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Multi-page reorganize button ═══ */}
          {selectionMode && selectedPages.size > 1 && (
            <button
              type="button"
              onClick={handleReorganize}
              disabled={regenerating}
              className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {regenerating ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Reorganizando...</>
              ) : (
                <><span className="material-symbols-outlined text-[16px]">auto_fix_high</span> Reorganizar {selectedPages.size} páginas</>
              )}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
