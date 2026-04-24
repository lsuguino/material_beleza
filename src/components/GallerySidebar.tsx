'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteFromGallery,
  listGallery,
  type GalleryItem,
} from '@/lib/gallery-storage';
import { savePreviewDataToClient } from '@/lib/preview-storage';
import { PageThumbnail } from '@/components/PageThumbnail';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import type { PreviewData } from '@/components/MaterialPreviewBlocks';

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Seção de "Materiais gerados" — renderiza como bloco pra encaixar dentro de outra sidebar.
 * - Thumbnail da capa (renderizado via PageThumbnail)
 * - Título + data
 * - Click abre o preview do material
 * - X (visível no hover) pede confirmação via Scribolito surpreso antes de deletar
 *
 * Props:
 * - refreshKey: bump pra forçar releitura da galeria
 * - collapsed: quando true, renderiza versão mínima (ou nada) — compatível com sidebar colapsada
 */
interface Props {
  refreshKey?: number;
  collapsed?: boolean;
}

export function GallerySidebar({ refreshKey = 0, collapsed = false }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null);

  const reload = useCallback(async () => {
    const list = await listGallery();
    setItems(list);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const handleOpen = useCallback(
    async (item: GalleryItem) => {
      await savePreviewDataToClient(item.previewData);
      router.push(`/preview?galleryId=${encodeURIComponent(item.id)}`);
    },
    [router],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await deleteFromGallery(pendingDelete.id);
    setPendingDelete(null);
    await reload();
  }, [pendingDelete, reload]);

  // Quando colapsada, só mostra um indicador discreto da contagem
  if (collapsed) {
    return (
      <section
        className="flex flex-col items-center gap-1 px-2 pb-4 pt-2"
        aria-label="Materiais já gerados"
      >
        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant/60 dark:text-white/40">
          Galeria
        </span>
        <span className="text-sm font-semibold text-on-surface dark:text-white">
          {items?.length ?? 0}
        </span>
      </section>
    );
  }

  if (items === null) {
    return (
      <section className="flex flex-col gap-2 px-6 pb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant dark:text-white/60">
          Materiais gerados
        </h3>
        <p className="text-xs text-on-surface-variant/80 dark:text-white/40">Carregando…</p>
      </section>
    );
  }

  return (
    <section
      className="flex flex-col gap-3 px-6 pb-6"
      aria-label="Materiais já gerados"
    >
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant dark:text-white/60">
          Materiais gerados
        </h3>
        {items.length > 0 && (
          <span className="text-xs text-on-surface-variant/70 dark:text-white/40" aria-live="polite">
            {items.length}
          </span>
        )}
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-on-surface-variant/30 p-6 text-center dark:border-white/15">
          <p className="text-sm text-on-surface-variant dark:text-white/60">
            Seus materiais aparecerão aqui após a primeira geração.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => handleOpen(item)}
                className="flex w-full gap-3 rounded-xl border border-on-surface-variant/15 bg-surface-container/60 p-2 text-left transition-colors hover:bg-surface-container dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#446EFF]"
              >
                <div className="shrink-0 overflow-hidden rounded border border-on-surface-variant/15 bg-white dark:border-white/10">
                  <PageThumbnail
                    data={item.previewData as PreviewData}
                    pageIndex={0}
                    width={72}
                    height={102}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
                  <p className="line-clamp-2 text-sm font-medium leading-tight text-on-surface dark:text-white">
                    {item.titulo || 'Sem título'}
                  </p>
                  <p className="text-[11px] text-on-surface-variant dark:text-white/50">
                    {formatDate(item.createdAt)}
                    {item.modo ? ` · ${item.modo}` : ''}
                    {typeof item.pageCount === 'number' ? ` · ${item.pageCount}p` : ''}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(item);
                }}
                aria-label={`Apagar "${item.titulo}"`}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 transition-opacity hover:bg-red-600 hover:text-white group-hover:opacity-100 focus:opacity-100"
              >
                <span className="text-sm leading-none">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteModal
        open={pendingDelete !== null}
        materialTitle={pendingDelete?.titulo}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
