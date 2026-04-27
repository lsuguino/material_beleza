'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ImageBox = { xPct: number; yPct: number; wPct: number; hPct: number };

interface Props {
  /** Container que contém o template renderizado. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Box atual da imagem em % da página A4 (caso a página já esteja em layout livre). */
  currentBox?: ImageBox | null;
  /** Scale visual do template no canvas. */
  scale?: number;
  /** Commit final no release. */
  onCommit: (box: ImageBox) => void;
}

/** A4 em template-pixels — origem do sistema de coordenadas % */
const PAGE_W = 595;
const PAGE_H = 842;
/** Limites em % pra evitar imagem invisível ou imagem que vaza fora da página */
const MIN_W_PCT = 8;
const MAX_W_PCT = 100;
const MIN_H_PCT = 6;
const MAX_H_PCT = 100;

type HandleKind = 'tl' | 'tr' | 'bl' | 'br' | 'move';

/**
 * Overlay de edição livre da imagem. Suporta:
 *  - Drag do corpo → move a imagem em qualquer direção (xPct/yPct).
 *  - Drag de qualquer canto → redimensiona ancorando o canto oposto.
 *
 * Box é sempre em % da página A4 (595×842 template-pixels), independente do
 * scale. O resultado vai pro `imagem_box` da página, renderizado por
 * `TemplateImagemLivre` (layout `A4_imagem_livre`).
 */
export function ImageResizeOverlay({
  containerRef,
  currentBox,
  scale = 1,
  onCommit,
}: Props) {
  const [pageRect, setPageRect] = useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  /** Box "âncora" — usada como base do drag e como visual quando idle */
  const [anchorBox, setAnchorBox] = useState<ImageBox | null>(null);
  /** Box live durante o drag (sobreescreve o anchor visualmente) */
  const [liveBox, setLiveBox] = useState<ImageBox | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleKind | null>(null);

  const dragRef = useRef<{
    handle: HandleKind;
    startX: number;
    startY: number;
    startBox: ImageBox;
  } | null>(null);

  /**
   * Mede a página A4 e a imagem-herói. Define a anchorBox em % da página.
   * Se a página já tem um currentBox (layout livre), usa ele direto.
   */
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const page = container.querySelector('.page-a4') as HTMLElement | null;
    if (!page) {
      setPageRect(null);
      setContainerRect(null);
      setAnchorBox(null);
      return;
    }
    const pRect = page.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    setPageRect(pRect);
    setContainerRect(cRect);

    if (currentBox) {
      setAnchorBox(currentBox);
      return;
    }

    // Fallback: deriva box da img-herói atual
    let target = page.querySelector('[data-image-flutuante-target]') as HTMLElement | null;
    if (!target) {
      const imgs = Array.from(page.querySelectorAll('img')) as HTMLImageElement[];
      let best: HTMLElement | null = null;
      let bestArea = 0;
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea && r.width > 60 && r.height > 60) {
          best = img;
          bestArea = area;
        }
      }
      target = best;
    }
    if (!target) {
      setAnchorBox(null);
      return;
    }
    const tRect = target.getBoundingClientRect();
    setAnchorBox({
      xPct: ((tRect.left - pRect.left) / pRect.width) * 100,
      yPct: ((tRect.top - pRect.top) / pRect.height) * 100,
      wPct: (tRect.width / pRect.width) * 100,
      hPct: (tRect.height / pRect.height) * 100,
    });
  }, [containerRef, currentBox]);

  useEffect(() => {
    measure();
    const id = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  /** Aplica delta em % da página a um box, conforme qual handle. Retorna box clampeado. */
  const applyDelta = (
    base: ImageBox,
    handle: HandleKind,
    dxPct: number,
    dyPct: number,
  ): ImageBox => {
    let { xPct, yPct, wPct, hPct } = base;
    switch (handle) {
      case 'move':
        xPct += dxPct;
        yPct += dyPct;
        break;
      case 'tl':
        xPct += dxPct;
        yPct += dyPct;
        wPct -= dxPct;
        hPct -= dyPct;
        break;
      case 'tr':
        yPct += dyPct;
        wPct += dxPct;
        hPct -= dyPct;
        break;
      case 'bl':
        xPct += dxPct;
        wPct -= dxPct;
        hPct += dyPct;
        break;
      case 'br':
        wPct += dxPct;
        hPct += dyPct;
        break;
    }
    // Garante mínimo
    if (wPct < MIN_W_PCT) {
      // Se o handle tirou a largura abaixo do mínimo, congela na borda
      if (handle === 'tl' || handle === 'bl') xPct = base.xPct + base.wPct - MIN_W_PCT;
      wPct = MIN_W_PCT;
    }
    if (hPct < MIN_H_PCT) {
      if (handle === 'tl' || handle === 'tr') yPct = base.yPct + base.hPct - MIN_H_PCT;
      hPct = MIN_H_PCT;
    }
    if (wPct > MAX_W_PCT) wPct = MAX_W_PCT;
    if (hPct > MAX_H_PCT) hPct = MAX_H_PCT;
    // Clamp dentro da página
    if (xPct < 0) xPct = 0;
    if (yPct < 0) yPct = 0;
    if (xPct + wPct > 100) xPct = 100 - wPct;
    if (yPct + hPct > 100) yPct = 100 - hPct;
    return { xPct, yPct, wPct, hPct };
  };

  const beginDrag = useCallback(
    (handle: HandleKind, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = anchorBox;
      const pr = pageRect;
      if (!cur || !pr) return;
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...cur },
      };
      setActiveHandle(handle);

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dxScreen = ev.clientX - drag.startX;
        const dyScreen = ev.clientY - drag.startY;
        const dxPct = (dxScreen / Math.max(0.1, scale) / PAGE_W) * 100;
        const dyPct = (dyScreen / Math.max(0.1, scale) / PAGE_H) * 100;
        const newBox = applyDelta(drag.startBox, drag.handle, dxPct, dyPct);
        setLiveBox(newBox);
      };
      const onUp = () => {
        const drag = dragRef.current;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const finalBox = liveBoxRef.current;
        setActiveHandle(null);
        setLiveBox(null);
        dragRef.current = null;
        if (drag && finalBox) {
          // Só commit se de fato moveu (evita commit em clique sem drag)
          const moved =
            Math.abs(finalBox.xPct - drag.startBox.xPct) > 0.1 ||
            Math.abs(finalBox.yPct - drag.startBox.yPct) > 0.1 ||
            Math.abs(finalBox.wPct - drag.startBox.wPct) > 0.1 ||
            Math.abs(finalBox.hPct - drag.startBox.hPct) > 0.1;
          if (moved) {
            // Atualiza anchor pra próximo drag começar do lugar certo
            setAnchorBox(finalBox);
            onCommit(finalBox);
          }
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [anchorBox, pageRect, scale, onCommit],
  );

  // Mantém ref atualizada do liveBox pra leitura no onUp (closures)
  const liveBoxRef = useRef<ImageBox | null>(null);
  useEffect(() => {
    liveBoxRef.current = liveBox || anchorBox;
  }, [liveBox, anchorBox]);

  if (!pageRect || !containerRect || !anchorBox) return null;

  const visualBox = liveBox ?? anchorBox;

  // Converte box (% da página) pra pixels relativos ao container (overlay é absolute, inset 0)
  const pageOffX = pageRect.left - containerRect.left;
  const pageOffY = pageRect.top - containerRect.top;
  const left = pageOffX + (visualBox.xPct / 100) * pageRect.width;
  const top = pageOffY + (visualBox.yPct / 100) * pageRect.height;
  const width = (visualBox.wPct / 100) * pageRect.width;
  const height = (visualBox.hPct / 100) * pageRect.height;

  const handleSize = 18;
  const moveInset = handleSize;
  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    backgroundColor: '#446EFF',
    border: '2px solid #fff',
    borderRadius: '50%',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
    zIndex: 25,
    touchAction: 'none',
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      {/* Borda destacada — sempre acompanha o box (live ou anchor) */}
      <div
        style={{
          position: 'absolute',
          top,
          left,
          width,
          height,
          border: liveBox ? '2px solid #4f46e5' : '2px dashed #446EFF',
          backgroundColor: liveBox ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 14,
          transition: liveBox ? 'none' : 'all 80ms linear',
        }}
      />
      {/* Label de tamanho durante drag */}
      {liveBox && (
        <div
          style={{
            position: 'absolute',
            top: top - 22,
            left,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: '#4f46e5',
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 18,
          }}
        >
          {Math.round(width)} × {Math.round(height)} px
        </div>
      )}
      {/* Área de drag-to-move (inset pra não cobrir os cantos) */}
      {width > moveInset * 2 && height > moveInset * 2 && (
        <div
          onPointerDown={(e) => beginDrag('move', e)}
          style={{
            position: 'absolute',
            top: top + moveInset,
            left: left + moveInset,
            width: width - moveInset * 2,
            height: height - moveInset * 2,
            pointerEvents: 'auto',
            zIndex: 16,
            cursor: activeHandle === 'move' ? 'grabbing' : 'grab',
            touchAction: 'none',
          }}
          aria-label="Mover imagem livremente"
        />
      )}
      {/* 4 alças nos cantos */}
      <div
        onPointerDown={(e) => beginDrag('tl', e)}
        style={{
          ...handleStyle,
          top: top - handleSize / 2,
          left: left - handleSize / 2,
          cursor: 'nwse-resize',
        }}
        aria-label="Redimensionar (canto superior esquerdo)"
      />
      <div
        onPointerDown={(e) => beginDrag('tr', e)}
        style={{
          ...handleStyle,
          top: top - handleSize / 2,
          left: left + width - handleSize / 2,
          cursor: 'nesw-resize',
        }}
        aria-label="Redimensionar (canto superior direito)"
      />
      <div
        onPointerDown={(e) => beginDrag('bl', e)}
        style={{
          ...handleStyle,
          top: top + height - handleSize / 2,
          left: left - handleSize / 2,
          cursor: 'nesw-resize',
        }}
        aria-label="Redimensionar (canto inferior esquerdo)"
      />
      <div
        onPointerDown={(e) => beginDrag('br', e)}
        style={{
          ...handleStyle,
          top: top + height - handleSize / 2,
          left: left + width - handleSize / 2,
          cursor: 'nwse-resize',
        }}
        aria-label="Redimensionar (canto inferior direito)"
      />
    </div>
  );
}
