'use client';

import { useState, useEffect } from 'react';

const SCRIBOLITO_PHRASES = [
  'Solte seu arquivo e deixa comigo!',
  'Experimente a geração de pasta completa!',
  'Que projetos vamos tocar agora?',
  'Isso vai ser interessante...',
  'Até que eu estou diagramando bem!',
  'Experimente gerar materiais com atividade!',
  'Em breve estarei gerando para outros cursos!',
  'Bora transformar conhecimento?',
  'Seu material vai ficar incrível!',
  'Estou pronto pra diagramar!',
  'Cola o VTT que eu resolvo!',
  'Mais um material de qualidade vindo!',
];

/**
 * Scribolito Walking Animation — CSS-only, SVG-based, scalable.
 *
 * Animação de caminhada com troca de expressões faciais.
 * 100% CSS (sem JavaScript timers), leve e escalável.
 *
 * Uso: <ScribolitoWalk size={120} />
 *
 * Os sprites devem estar em public/scribolito/walk/ e public/scribolito/faces/
 * Exportados como SVG do Figma (seções "Andando scribolito" e "Rostos scribolito").
 *
 * Se os sprites não estiverem disponíveis, um fallback de placeholder é mostrado.
 */

interface ScribolitoWalkProps {
  /** Altura em px (default 120). Escalável — funciona em qualquer tamanho */
  size?: number;
  /** Velocidade: 'slow' | 'normal' | 'fast' */
  speed?: 'slow' | 'normal' | 'fast';
  /** Classe CSS adicional */
  className?: string;
  /** Se true, o personagem se move horizontalmente */
  moving?: boolean;
  /** Texto do balão de fala (vazio = sem balão) */
  balloon?: string;
  /** Mostrar sombra no chão */
  shadow?: boolean;
}

const SPEED_MAP = { slow: '1.2s', normal: '0.8s', fast: '0.5s' };

export function ScribolitoWalk({
  size = 120,
  speed = 'normal',
  className = '',
  moving = false,
  balloon = '',
  shadow = true,
}: ScribolitoWalkProps) {
  const animDuration = SPEED_MAP[speed];

  // Rotação automática de frases quando balloon não é definido ou é vazio
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * SCRIBOLITO_PHRASES.length));
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % SCRIBOLITO_PHRASES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const displayBalloon = balloon || SCRIBOLITO_PHRASES[phraseIndex];

  return (
    <>
      <style>{`
        @keyframes scribolito-walk {
          0% { opacity: 1; }
          18% { opacity: 1; }
          20% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes scribolito-face {
          0%, 24% { opacity: 1; }
          25%, 100% { opacity: 0; }
        }
        @keyframes scribolito-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3%); }
        }
        @keyframes scribolito-shadow {
          0%, 100% { transform: scaleX(1); opacity: 0.15; }
          50% { transform: scaleX(1.3); opacity: 0.08; }
        }
        @keyframes scribolito-move {
          0% { transform: translateX(-10%); }
          100% { transform: translateX(110%); }
        }
        .scribolito-frame {
          position: absolute;
          inset: 0;
          opacity: 0;
        }
        .scribolito-frame:nth-child(1) { animation: scribolito-walk ${animDuration} steps(1) 0s infinite; }
        .scribolito-frame:nth-child(2) { animation: scribolito-walk ${animDuration} steps(1) calc(${animDuration} * 0.2) infinite; }
        .scribolito-frame:nth-child(3) { animation: scribolito-walk ${animDuration} steps(1) calc(${animDuration} * 0.4) infinite; }
        .scribolito-frame:nth-child(4) { animation: scribolito-walk ${animDuration} steps(1) calc(${animDuration} * 0.6) infinite; }
        .scribolito-frame:nth-child(5) { animation: scribolito-walk ${animDuration} steps(1) calc(${animDuration} * 0.8) infinite; }
        .scribolito-face-frame {
          position: absolute;
          opacity: 0;
        }
        .scribolito-face-frame:nth-child(1) { animation: scribolito-face 6s steps(1) 0s infinite; }
        .scribolito-face-frame:nth-child(2) { animation: scribolito-face 6s steps(1) 1.5s infinite; }
        .scribolito-face-frame:nth-child(3) { animation: scribolito-face 6s steps(1) 3s infinite; }
        .scribolito-face-frame:nth-child(4) { animation: scribolito-face 6s steps(1) 4.5s infinite; }
      `}</style>
      <div
        className={`inline-flex flex-col items-center ${className}`}
        aria-label="Scribolito caminhando"
        role="img"
      >
      {/* Balão de fala — rotação automática de frases */}
      {displayBalloon && (
        <div style={{
          position: 'relative',
          maxWidth: size * 0.95,
          marginBottom: -size * 0.02,
          zIndex: 2,
          animation: `scribolito-bounce ${animDuration} ease-in-out infinite`,
        }}>
          <div style={{
            backgroundColor: 'rgba(32,127,213,0.95)',
            borderRadius: size * 0.06,
            padding: `${size * 0.03}px ${size * 0.05}px`,
            fontSize: size * 0.04,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: '#ffffff',
            lineHeight: 1.4,
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            {displayBalloon}
          </div>
          {/* Seta do balão */}
          <div style={{
            width: 0,
            height: 0,
            borderLeft: `${size * 0.03}px solid transparent`,
            borderRight: `${size * 0.03}px solid transparent`,
            borderTop: `${size * 0.025}px solid rgba(32,127,213,0.95)`,
            margin: '0 auto',
            marginRight: '30%',
          }} />
        </div>
      )}

      {/* Wrapper para espelhar só o personagem */}
      <div style={{ transform: 'scaleX(-1)', width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          animation: moving
            ? `scribolito-move 8s linear infinite, scribolito-bounce ${animDuration} ease-in-out infinite`
            : `scribolito-bounce ${animDuration} ease-in-out infinite`,
        }}
      >
        {/* Walk frames — 5 body positions cycling */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Suporta SVG (preferido) ou PNG como fallback */}
          {[1, 2, 3, 4, 5].map(i => (
            <img
              key={`walk-${i}`}
              src={`/scribolito/walk/passo-0${i}.svg`}
              onError={(e) => { (e.target as HTMLImageElement).src = `/scribolito/walk/passo-0${i}.png`; }}
              alt=""
              className="scribolito-frame"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              draggable={false}
              aria-hidden
            />
          ))}
        </div>

        {/* Face frames — 4 expressions cycling independently */}
        {/* Posição extraída do Figma: x=218/608, y=186/784, w=242/608, h=256/784 */}
        <div style={{
          position: 'absolute',
          top: '23.7%',
          left: '35.9%',
          width: '39.8%',
          height: '32.7%',
        }}>
          {['relaxado', 'Sorrindo', 'Apaixonado', 'Surpreso'].map(face => (
            <img
              key={face}
              src={`/scribolito/faces/${face}.svg`}
              onError={(e) => { (e.target as HTMLImageElement).src = `/scribolito/faces/${face}.png`; }}
              alt=""
              className="scribolito-face-frame"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              draggable={false}
              aria-hidden
            />
          ))}
        </div>
      </div>
      </div>

      {/* Sombra no chão — expande quando sobe, contrai quando desce */}
      {shadow && (
        <div style={{
          width: size * 0.6,
          height: size * 0.06,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%)',
          marginTop: size * -0.03,
          animation: `scribolito-shadow ${animDuration} ease-in-out infinite`,
        }} />
      )}
      </div>
    </>
  );
}
