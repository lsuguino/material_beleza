'use client';

import React from 'react';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';

interface PageThumbnailProps {
  data: PreviewData;
  pageIndex: number;
  width?: number;
  height?: number;
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
}: PageThumbnailProps) {
  const thumbScale = width / 595;

  return (
    <div
      style={{ width, height, overflow: 'hidden', pointerEvents: 'none' }}
    >
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
