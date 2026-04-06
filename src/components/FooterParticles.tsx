'use client';

import { useEffect, useRef } from 'react';

const N = 18;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  phase: number;
  blurPhase: number; // drives blur animation (matches dropzone fade-pulse)
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

    // Read primary colour from CSS variable at runtime (respects dark/light mode)
    const readRgb = (): [number, number, number] => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--scribo-primary-rgb')
        .trim();
      const parts = raw.split(/\s+/).map(Number);
      return [parts[0] ?? 26, parts[1] ?? 45, parts[2] ?? 194];
    };

    let [cr, cg, cb] = readRgb();

    // Re-read on theme change
    const observer = new MutationObserver(() => { [cr, cg, cb] = readRgb(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

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
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 20 + Math.random() * 60,        // 20–80px radius (big soft blobs)
        opacity: 0.55 + Math.random() * 0.3, // matches dropzone blob opacity
        phase: Math.random() * Math.PI * 2,
        blurPhase: Math.random() * Math.PI * 2,
      }));

    let particles = makeParticles(canvas.width || 800, canvas.height || 440);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let t = 0;
    const FADE_TOP = 0.40; // top 40% fades → particles appear "behind" card above

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
        p.blurPhase += 0.025;

        if (generating) {
          // Breathing: slow pulse toward top (progress bar direction) then back
          const breathe = Math.sin(t * 0.65 + p.phase) * 0.8;
          p.vy += (breathe - p.vy) * 0.03;
          p.vx *= 0.98;
        } else if (hasFile) {
          // Agitated — faster random walk
          p.vx += (Math.random() - 0.5) * 0.10;
          p.vy += (Math.random() - 0.5) * 0.10;
          const spd = Math.hypot(p.vx, p.vy);
          if (spd > 1.8) { p.vx *= 1.8 / spd; p.vy *= 1.8 / spd; }
        } else {
          // Idle — very slow drift
          p.vx += (Math.random() - 0.5) * 0.022;
          p.vy += (Math.random() - 0.5) * 0.022;
          const spd = Math.hypot(p.vx, p.vy);
          if (spd > 0.45) { p.vx *= 0.45 / spd; p.vy *= 0.45 / spd; }
        }

        // Mouse repulsion
        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const R = 100 + p.r;
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
        const edgeFade = p.y < fadeTop ? p.y / fadeTop : 1;
        if (edgeFade <= 0.01) continue;

        // Blur oscillates between 10px and 16px (matches dropzone fade-pulse keyframes)
        const blurPx = 10 + (Math.sin(p.blurPhase) * 0.5 + 0.5) * 6;

        // Radial gradient — matches .dropzone-particle-blob CSS:
        //   circle at 32% 32%: highlight offset = -0.36 × r
        const ox = p.x - p.r * 0.36;
        const oy = p.y - p.r * 0.36;
        const grad = ctx.createRadialGradient(ox, oy, 0, p.x, p.y, p.r);
        const a0 = (p.opacity * edgeFade * 0.55).toFixed(3); // center stop
        const a1 = (p.opacity * edgeFade * 0.18).toFixed(3); // mid stop
        grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${a0})`);
        grad.addColorStop(0.42, `rgba(${cr},${cg},${cb},${a1})`);
        grad.addColorStop(0.68, `rgba(${cr},${cg},${cb},0)`);
        grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);

        ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.filter = 'none';
    };

    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
      observer.disconnect();
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
