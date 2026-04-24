'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

type DropzoneParticlesProps = {
  /** Label ou área que delimita o hover (coordenadas relativas a este elemento). */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Quando verdadeiro, aumenta velocidade, intensidade e quantidade de partículas. */
  hasFile?: boolean;
  /** Modo geração: orbes mais lentos, movimento tipo respiração (CSS no pai). */
  generating?: boolean;
};

/** 10 partículas base — sempre visíveis */
const SPECS_BASE: { slot: number; style: React.CSSProperties; extraBlobClass?: string }[] = [
  { slot: 1,  style: { left: '4%',  top: '8%',    width: '5.5rem', height: '5.5rem' } },
  { slot: 2,  style: { right: '6%', top: '12%',   width: '4rem',   height: '4rem'   } },
  { slot: 3,  style: { left: '38%', bottom: '6%', width: '6rem',   height: '6rem'   } },
  { slot: 4,  style: { left: '52%', top: '4%',    width: '3rem',   height: '3rem'   }, extraBlobClass: 'dropzone-particle-blob--accent' },
  { slot: 5,  style: { right: '22%',bottom: '18%',width: '4.5rem', height: '4.5rem' } },
  { slot: 6,  style: { left: '18%', top: '42%',   width: '2.5rem', height: '2.5rem' }, extraBlobClass: 'dropzone-particle-blob--dense' },
  { slot: 7,  style: { right: '38%',top: '38%',   width: '3.5rem', height: '3.5rem' } },
  { slot: 8,  style: { left: '62%', bottom: '28%',width: '2.75rem',height: '2.75rem'} },
  { slot: 9,  style: { left: '8%',  bottom: '22%',width: '3.25rem',height: '3.25rem'} },
  { slot: 10, style: { right: '12%',bottom: '8%', width: '5rem',   height: '5rem'   } },
];

/** 10 partículas extras — aparecem ao selecionar arquivo */
const SPECS_EXTRA: { slot: number; style: React.CSSProperties; extraBlobClass?: string }[] = [
  { slot: 11, style: { left: '28%', top: '18%',   width: '3rem',   height: '3rem'   }, extraBlobClass: 'dropzone-particle-blob--accent' },
  { slot: 12, style: { left: '72%', top: '22%',   width: '2.5rem', height: '2.5rem' } },
  { slot: 13, style: { left: '45%', top: '50%',   width: '4rem',   height: '4rem'   }, extraBlobClass: 'dropzone-particle-blob--dense' },
  { slot: 14, style: { left: '82%', bottom: '30%',width: '3.5rem', height: '3.5rem' } },
  { slot: 15, style: { left: '14%', top: '22%',   width: '2rem',   height: '2rem'   } },
  { slot: 16, style: { left: '58%', top: '12%',   width: '3.25rem',height: '3.25rem'} },
  { slot: 17, style: { left: '32%', bottom: '32%',width: '2.25rem',height: '2.25rem'}, extraBlobClass: 'dropzone-particle-blob--accent' },
  { slot: 18, style: { right: '4%', bottom: '42%',width: '4.5rem', height: '4.5rem' } },
  { slot: 19, style: { left: '76%', bottom: '12%',width: '2rem',   height: '2rem'   }, extraBlobClass: 'dropzone-particle-blob--dense' },
  { slot: 20, style: { left: '24%', bottom: '48%',width: '3rem',   height: '3rem'   } },
];

const ALL_SPECS = [...SPECS_BASE, ...SPECS_EXTRA];
const N_TOTAL = ALL_SPECS.length; // 20

const REPULSE_RADIUS = 155;
const REPULSE_GAIN   = 78;
const ATTRACT_MIN    = 95;
const ATTRACT_MAX    = 300;
const ATTRACT_GAIN   = 22;
const SMOOTH         = 0.13;

export function DropzoneParticles({ containerRef, hasFile = false, generating = false }: DropzoneParticlesProps) {
  const outerRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const offsetsRef  = useRef<{ x: number; y: number }[]>(
    Array.from({ length: N_TOTAL }, () => ({ x: 0, y: 0 }))
  );
  const targetsRef  = useRef<{ x: number; y: number }[]>(
    Array.from({ length: N_TOTAL }, () => ({ x: 0, y: 0 }))
  );
  const restCentersRef  = useRef<{ x: number; y: number }[]>([]);
  const mouseRef        = useRef<{ x: number; y: number } | null>(null);
  const rafRef          = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  const measureRest = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    for (let i = 0; i < N_TOTAL; i++) {
      const el = outerRefs.current[i];
      if (el) {
        el.style.transform = '';
        offsetsRef.current[i] = { x: 0, y: 0 };
      }
    }
    void root.offsetHeight;
    const rr   = root.getBoundingClientRect();
    const next: { x: number; y: number }[] = [];
    for (let i = 0; i < N_TOTAL; i++) {
      const el = outerRefs.current[i];
      if (!el) { next.push({ x: 0, y: 0 }); continue; }
      const pr = el.getBoundingClientRect();
      next.push({
        x: pr.left - rr.left + pr.width  / 2,
        y: pr.top  - rr.top  + pr.height / 2,
      });
    }
    restCentersRef.current = next;
  }, [containerRef]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onMq = () => { reducedMotionRef.current = mq.matches; };
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  useLayoutEffect(() => { measureRest(); }, [measureRest]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measureRest());
    ro.observe(root);
    return () => ro.disconnect();
  }, [containerRef, measureRest]);

  const computeTargets = useCallback(() => {
    if (reducedMotionRef.current) {
      for (let i = 0; i < N_TOTAL; i++) targetsRef.current[i] = { x: 0, y: 0 };
      return;
    }
    const mouse = mouseRef.current;
    for (let i = 0; i < N_TOTAL; i++) {
      const c = restCentersRef.current[i];
      if (!c) { targetsRef.current[i] = { x: 0, y: 0 }; continue; }
      let tx = 0, ty = 0;
      if (mouse) {
        const dx   = c.x - mouse.x;
        const dy   = c.y - mouse.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < REPULSE_RADIUS) {
          const t = Math.pow((REPULSE_RADIUS - dist) / REPULSE_RADIUS, 1.15);
          const s = t * REPULSE_GAIN;
          tx += (dx / dist) * s;
          ty += (dy / dist) * s;
        }
        if (dist > ATTRACT_MIN && dist < ATTRACT_MAX) {
          const n = (dist - ATTRACT_MIN) / (ATTRACT_MAX - ATTRACT_MIN);
          const t = (1 - n) * (1 - n);
          const s = t * ATTRACT_GAIN;
          tx -= (dx / dist) * s;
          ty -= (dy / dist) * s;
        }
      }
      targetsRef.current[i] = { x: tx, y: ty };
    }
  }, []);

  const tick = useCallback(() => {
    computeTargets();
    for (let i = 0; i < N_TOTAL; i++) {
      const o  = offsetsRef.current[i];
      const t  = targetsRef.current[i];
      o.x += (t.x - o.x) * SMOOTH;
      o.y += (t.y - o.y) * SMOOTH;
      const el = outerRefs.current[i];
      if (el) el.style.transform = `translate(${o.x.toFixed(2)}px, ${o.y.toFixed(2)}px)`;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [computeTargets]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onMove = (e: MouseEvent) => {
      if (reducedMotionRef.current) return;
      const rr = root.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rr.left, y: e.clientY - rr.top };
    };
    const onLeave = () => { mouseRef.current = null; };
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseleave', onLeave);
    return () => {
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseleave', onLeave);
    };
  }, [containerRef]);

  const active = hasFile || generating;
  return (
    <div
      className={`dropzone-blue-particles${active ? ' dropzone-blue-particles--active' : ''}${generating ? ' dropzone-blue-particles--generating' : ''}`}
      aria-hidden
    >
      {/* Partículas base (slots 1-10) — sempre visíveis */}
      {SPECS_BASE.map((spec, i) => (
        <div
          key={spec.slot}
          ref={(el) => { outerRefs.current[i] = el; }}
          className="dropzone-particle-outer"
          style={{ position: 'absolute', ...spec.style, willChange: 'transform' }}
        >
          <div className={`dropzone-particle-drift dropzone-particle-drift--${spec.slot}`}>
            <div className={`dropzone-particle-blob ${spec.extraBlobClass ?? ''}`} />
          </div>
        </div>
      ))}

      {/* Partículas extras (slots 11-20) — fade-in ao selecionar arquivo */}
      <div
        className="dropzone-particles-extra"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: active ? 1 : 0,
          transition: 'opacity 0.7s ease-in-out',
          pointerEvents: 'none',
        }}
      >
        {SPECS_EXTRA.map((spec, i) => (
          <div
            key={spec.slot}
            ref={(el) => { outerRefs.current[SPECS_BASE.length + i] = el; }}
            className="dropzone-particle-outer"
            style={{ position: 'absolute', ...spec.style, willChange: 'transform' }}
          >
            <div className={`dropzone-particle-drift dropzone-particle-drift--${spec.slot}`}>
              <div className={`dropzone-particle-blob ${spec.extraBlobClass ?? ''}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
