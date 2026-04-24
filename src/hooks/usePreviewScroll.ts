'use client';

import { useCallback, useEffect, useRef, useState, type RefObject, type MutableRefObject } from 'react';

export function usePreviewScroll(
  canvasRef: RefObject<HTMLDivElement | null>,
  pageRefs: MutableRefObject<(HTMLDivElement | null)[]>,
  pageCount: number,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);

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

  return { currentPage, scale, scrollToPage, handleScroll };
}
