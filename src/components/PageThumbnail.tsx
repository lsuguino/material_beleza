'use client';

import React from 'react';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';

interface PageThumbnailProps {
  data: PreviewData;
  pageIndex: number;
  width?: number;
  height?: number;
  pageNumber?: number;
}

/**
 * Miniatura de uma única página do material.
 * Renderiza a página real em 595×842 e aplica CSS scale para caber no tamanho desejado.
 */
export const PageThumbnail = React.memo(function PageThumbnail({
  data,
  pageIndex,
  width = 70,
  height = 99,
  pageNumber,
}: PageThumbnailProps) {
  const thumbScale = width / 595;
  const displayPageNumber = pageNumber ?? pageIndex + 1;

  return (
    <div
      style={{ width, height, overflow: 'hidden', pointerEvents: 'none', position: 'relative' }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 2,
          fontSize: 10,
          lineHeight: '14px',
          fontWeight: 700,
          color: '#ffffff',
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          borderRadius: 999,
          padding: '0 6px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
      >
        {displayPageNumber}
      </span>
      <div
        style={{
          width: 595,
          transform: `scale(${thumbScale})`,
          transformOrigin: 'top left',
        }}
      >
        <MaterialPreviewBlocks
          data={data}
          scale={1}
          singlePageIndex={pageIndex}
        />
      </div>
    </div>
  );
});
