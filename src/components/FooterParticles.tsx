'use client';

import { useEffect, useRef } from 'react';

const N = 18;
const COLORS = ['#03DFE6', '#0599A8', '#025468'] as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  phase: number;
  colorIdx: number;
}

interface FooterParticlesProps {
  hasFile: boolean;
  generating: boolean;
}

export function FooterParticles({ hasFile, generating }: FooterParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ hasFile, generating });
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    stateRef.current = { hasFile, generating };
  }, [hasFile, generating]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const makeParticles = (w: number, h: number): Particle[] =>
      Array.from({ length: N }, () => ({
        x: Math.random() * w,
        // start scattered across full canvas height
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 4 + Math.random() * 20,         // 4–24 px radius (mix of sizes)
        opacity: 0.07 + Math.random() * 0.17,
        phase: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * COLORS.length),
      }));

    let particles = makeParticles(canvas.width || 800, canvas.height || 420);

    // Track mouse anywhere on the page, convert to canvas-local coords
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let t = 0;
    const FADE_TOP = 0.38; // top 38% fades → visual "behind the card" effect

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;

      ctx.clearRect(0, 0, w, h);
      t += 0.008;

      const { hasFile, generating } = stateRef.current;
      const mouse = mouseRef.current;

      for (const p of particles) {
        p.phase += 0.006;

        if (generating) {
          // Breathing: slow pulse upward (toward progress bar) then back
          const breathe = Math.sin(t * 0.65 + p.phase) * 0.8;
          p.vy += (breathe - p.vy) * 0.03;
          p.vx *= 0.98;
        } else if (hasFile) {
          // Agitated — faster random walk
          p.vx += (Math.random() - 0.5) * 0.12;
          p.vy += (Math.random() - 0.5) * 0.12;
          const spd = Math.hypot(p.vx, p.vy);
          if (spd > 2.0) { p.vx *= 2.0 / spd; p.vy *= 2.0 / spd; }
        } else {
          // Idle — very slow drift
          p.vx += (Math.random() - 0.5) * 0.025;
          p.vy += (Math.random() - 0.5) * 0.025;
          const spd = Math.hypot(p.vx, p.vy);
          if (spd > 0.5) { p.vx *= 0.5 / spd; p.vy *= 0.5 / spd; }
        }

        // Mouse repulsion
        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const R = 90 + p.r * 2;
          if (dist < R && dist > 1) {
            const f = ((R - dist) / R) * 3.5;
            p.vx += (dx / dist) * f;
            p.vy += (dy / dist) * f;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        const pad = p.r + 2;
        if (p.x < -pad) p.x = w + pad;
        else if (p.x > w + pad) p.x = -pad;
        if (p.y < -pad) p.y = h + pad;
        else if (p.y > h + pad) p.y = -pad;

        // Fade near top → illusion of going behind the card above
        const fadeTop = h * FADE_TOP;
        const alpha = p.y < fadeTop ? (p.y / fadeTop) * p.opacity : p.opacity;
        if (alpha <= 0.004) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[p.colorIdx];
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // re-init particles on resize
      if (particles.length > 0 && (particles[0].x > w * 1.5)) {
        particles = makeParticles(w, h);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute bottom-0 left-0 w-full pointer-events-none"
      style={{ height: 440, zIndex: -1 }}
    />
  );
}
