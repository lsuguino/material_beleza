'use client';

import { useCallback, useEffect, useRef, useState, type RefObject, type MutableRefObject } from 'react';

/** Limites do zoom manual (multiplicador sobre o scale auto-fit). */
export const USER_ZOOM_MIN = 0.5;
export const USER_ZOOM_MAX = 2;
const USER_ZOOM_STORAGE_KEY = 'rtg-preview-user-zoom';

function readPersistedUserZoom(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = window.localStorage.getItem(USER_ZOOM_STORAGE_KEY);
    if (!raw) return 1;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(USER_ZOOM_MAX, Math.max(USER_ZOOM_MIN, parsed));
  } catch {
    return 1;
  }
}

export function usePreviewScroll(
  canvasRef: RefObject<HTMLDivElement | null>,
  pageRefs: MutableRefObject<(HTMLDivElement | null)[]>,
  pageCount: number,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  /** Multiplicador manual (1 = 100% do scale auto-fit). Persiste em localStorage. */
  const [userZoom, setUserZoomState] = useState<number>(() => readPersistedUserZoom());

  const setUserZoom = useCallback((next: number) => {
    const clamped = Math.min(USER_ZOOM_MAX, Math.max(USER_ZOOM_MIN, next));
    setUserZoomState(clamped);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(USER_ZOOM_STORAGE_KEY, String(clamped));
      } catch {
        /* storage cheio / desabilitado — ignora */
      }
    }
  }, []);

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
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    handleScroll();
    canvas.addEventListener('scroll', handleScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', handleScroll);
  }, [canvasRef, pageCount, handleScroll]);

  const scrollToPage = useCallback(
    (index: number) => {
      pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
    },
    [pageRefs],
  );

  // Responsive scale: fit 595px pages into available width
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('rtg-pdf-mode') === '1') {
      setScale(1);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const compute = () => {
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
  }, [canvasRef, pageCount]);

  // Keep refs array aligned with page count
  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, pageCount);
  }, [pageRefs, pageCount]);

  /** Scale efetivo passado pros componentes — combina auto-fit + zoom manual. */
  const effectiveScale = scale * userZoom;

  return {
    currentPage,
    scale: effectiveScale,
    autoFitScale: scale,
    userZoom,
    setUserZoom,
    scrollToPage,
    handleScroll,
  };
}
