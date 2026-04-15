'use client';

import { useEffect, useRef } from 'react';

/**
 * Inicializa e executa Mermaid.js em todos os elementos .mermaid dentro do container.
 * Use como wrapper da área que contém <div class="mermaid">[código]</div>.
 */
interface MermaidInitProps {
  children: React.ReactNode;
  className?: string;
}

export function MermaidInit({ children, className = '' }: MermaidInitProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const run = async () => {
      const nodes = container.querySelectorAll('.mermaid[data-mermaid-code]');
      if (!nodes.length) return;

      const mermaid = (await import('mermaid')).default;
      if (cancelled) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        themeVariables: {
          primaryColor: '#004d40',
          edgeLabelBackground: '#ffffff',
          tertiaryColor: '#f4f4f4',
        },
      });

      for (const node of Array.from(nodes)) {
        if (cancelled) break;
        const code = (node as HTMLElement).getAttribute('data-mermaid-code');
        if (!code || (node as HTMLElement).querySelector('svg')) continue;
        try {
          const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
          const { svg } = await mermaid.render(id, code);
          (node as HTMLElement).innerHTML = svg;
          (node as HTMLElement).removeAttribute('data-mermaid-code');
        } catch {
          // manter código bruto em caso de erro de parse
        }
      }
    };

    const t = setTimeout(run, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [children]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
