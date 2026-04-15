'use client';

import { useState, useEffect } from 'react';

/**
 * Scribolito — mascote animado do Scribo.
 *
 * Animação de caminhada com 5 frames + troca de rostos.
 * Os sprites são exportados do Figma (seções "Andando scribolito" e "Rostos scribolito").
 *
 * Para exportar os sprites:
 * 1. No Figma, selecione cada frame de caminhada (passo-01 a passo-05)
 * 2. Exporte como PNG com height=200px
 * 3. Salve em public/scribolito/walk/passo-01.png ... passo-05.png
 * 4. Faça o mesmo para os rostos em public/scribolito/faces/
 */

const WALK_FRAMES = [
  '/scribolito/walk/passo-01.png',
  '/scribolito/walk/passo-02.png',
  '/scribolito/walk/passo-03.png',
  '/scribolito/walk/passo-04.png',
  '/scribolito/walk/passo-05.png',
];

const FACE_FRAMES = [
  '/scribolito/faces/relaxado.png',
  '/scribolito/faces/sorrindo.png',
  '/scribolito/faces/apaixonado.png',
  '/scribolito/faces/surpreso.png',
];

interface ScribolitoProps {
  /** Altura em px (default: 120) */
  size?: number;
  /** Velocidade da animação de caminhada em ms (default: 150) */
  walkSpeed?: number;
  /** Intervalo de troca de rosto em ms (default: 3000) */
  faceChangeInterval?: number;
  /** Mostrar caminhando (true) ou parado (false) */
  walking?: boolean;
  /** CSS class adicional */
  className?: string;
}

export function Scribolito({
  size = 120,
  walkSpeed = 150,
  faceChangeInterval = 3000,
  walking = true,
  className = '',
}: ScribolitoProps) {
  const [walkFrame, setWalkFrame] = useState(0);
  const [faceFrame, setFaceFrame] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload images
  useEffect(() => {
    let loaded = 0;
    const total = WALK_FRAMES.length + FACE_FRAMES.length;
    const allFrames = [...WALK_FRAMES, ...FACE_FRAMES];

    allFrames.forEach(src => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded >= total) setImagesLoaded(true);
      };
      img.onerror = () => {
        loaded++;
        if (loaded >= total) setImagesLoaded(true);
      };
      img.src = src;
    });
  }, []);

  // Walk animation
  useEffect(() => {
    if (!walking || !imagesLoaded) return;
    const interval = setInterval(() => {
      setWalkFrame(prev => (prev + 1) % WALK_FRAMES.length);
    }, walkSpeed);
    return () => clearInterval(interval);
  }, [walking, walkSpeed, imagesLoaded]);

  // Face change animation
  useEffect(() => {
    if (!imagesLoaded) return;
    const interval = setInterval(() => {
      setFaceFrame(prev => (prev + 1) % FACE_FRAMES.length);
    }, faceChangeInterval);
    return () => clearInterval(interval);
  }, [faceChangeInterval, imagesLoaded]);

  if (!imagesLoaded) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <div className="animate-pulse bg-primary/20 rounded-lg" style={{ width: size * 0.6, height: size }} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Walk body */}
      <img
        src={walking ? WALK_FRAMES[walkFrame] : WALK_FRAMES[0]}
        alt="Scribolito"
        width={size}
        height={size}
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />
      {/* Face overlay — positioned on the "book page" area of the character */}
      <img
        src={FACE_FRAMES[faceFrame]}
        alt=""
        className="absolute select-none pointer-events-none"
        style={{
          width: size * 0.28,
          height: size * 0.25,
          top: size * 0.18,
          left: size * 0.32,
          objectFit: 'contain',
        }}
        draggable={false}
        aria-hidden
      />
    </div>
  );
}
