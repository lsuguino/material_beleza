'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Box = { xPct: number; yPct: number; wPct: number; hPct: number };

type Props = {
  /** Ref do wrapper que contém o `.page-a4`. As coordenadas são calculadas relativas à página. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Chamado quando o usuário solta o mouse com um retângulo válido (em % da página). */
  onCommit: (box: Box) => void;
  /** Chamado quando ESC é pressionado ou o usuário cancela. */
  onCancel: () => void;
};

/**
 * Overlay que captura drag-to-draw sobre a página A4 selecionada.
 * Renderiza um retângulo de seleção enquanto o usuário arrasta e devolve as
 * coordenadas em porcentagem da área da página (0–100) — assim a posição
 * permanece correta independentemente do `scale` aplicado no preview.
 */
export function FreeDrawOverlay({ containerRef, onCommit, onCancel }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  // Localiza o elemento `.page-a4` real dentro do container — é a referência de coordenadas.
  const getPageRect = useCallback((): DOMRect | null => {
    const root = containerRef.current;
    if (!root) return null;
    const page = root.querySelector('.page-a4') as HTMLElement | null;
    return (page ?? root).getBoundingClientRect();
  }, [containerRef]);

  // ESC cancela
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = getPageRect();
      if (!rect) return;
      e.preventDefault();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDrag({ startX: x, startY: y, curX: x, curY: y });
    },
    [getPageRect],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return;
      const rect = getPageRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      setDrag((d) => (d ? { ...d, curX: x, curY: y } : d));
    },
    [drag, getPageRect],
  );

  const handleMouseUp = useCallback(() => {
    if (!drag) return;
    const rect = getPageRect();
    setDrag(null);
    if (!rect) return;
    const left = Math.min(drag.startX, drag.curX);
    const top = Math.min(drag.startY, drag.curY);
    const width = Math.abs(drag.curX - drag.startX);
    const height = Math.abs(drag.curY - drag.startY);
    // Ignora "cliques acidentais" muito pequenos
    if (width < 12 || height < 12) {
      onCancel();
      return;
    }
    const xPct = (left / rect.width) * 100;
    const yPct = (top / rect.height) * 100;
    const wPct = (width / rect.width) * 100;
    const hPct = (height / rect.height) * 100;
    onCommit({ xPct, yPct, wPct, hPct });
  }, [drag, getPageRect, onCommit]);

  // Posiciona o overlay sobre o `.page-a4`
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const root = containerRef.current;
      if (!root) return;
      const page = root.querySelector('.page-a4') as HTMLElement | null;
      const target = page ?? root;
      const tRect = target.getBoundingClientRect();
      const rRect = root.getBoundingClientRect();
      setBox({
        left: tRect.left - rRect.left,
        top: tRect.top - rRect.top,
        width: tRect.width,
        height: tRect.height,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const id = window.setInterval(update, 200);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.clearInterval(id);
    };
  }, [containerRef]);

  if (!box) return null;

  const selX = drag ? Math.min(drag.startX, drag.curX) : 0;
  const selY = drag ? Math.min(drag.startY, drag.curY) : 0;
  const selW = drag ? Math.abs(drag.curX - drag.startX) : 0;
  const selH = drag ? Math.abs(drag.curY - drag.startY) : 0;

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        cursor: 'crosshair',
        zIndex: 30,
        backgroundColor: 'rgba(15, 23, 42, 0.18)',
        userSelect: 'none',
      }}
    >
      {/* Hint */}
      {!drag && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Arraste para desenhar onde a imagem vai entrar (ESC cancela)
        </div>
      )}
      {drag && selW > 0 && selH > 0 && (
        <div
          style={{
            position: 'absolute',
            left: selX,
            top: selY,
            width: selW,
            height: selH,
            border: '2px dashed #4f46e5',
            background: 'rgba(79, 70, 229, 0.15)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -22,
              left: 0,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              background: '#4f46e5',
              padding: '2px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {Math.round(selW)} × {Math.round(selH)}
          </div>
        </div>
      )}
    </div>
  );
}
