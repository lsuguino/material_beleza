'use client';

import React, { useEffect, useRef } from 'react';

export interface ChartDataPayload {
  tipo: 'barra' | 'pizza' | 'linha';
  titulo: string;
  labels: string[];
  valores: number[];
}

interface ChartBlockProps {
  /** JSON string do content_blocks type "chart" */
  content: string;
  className?: string;
}

const CHART_COLORS = [
  'rgba(15, 24, 35, 0.85)',
  'rgba(0, 110, 255, 0.85)',
  'rgba(85, 184, 161, 0.85)',
  'rgba(100, 116, 139, 0.85)',
  'rgba(30, 41, 59, 0.85)',
];

/** Remove cercas markdown e extrai o primeiro objeto JSON do texto (IA costuma envolver o chart). */
function parseChartJson(raw: string): ChartDataPayload | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/im.exec(s);
  if (fence) s = fence[1].trim();
  const objStart = s.indexOf('{');
  const objEnd = s.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    s = s.slice(objStart, objEnd + 1);
  }
  try {
    const data = JSON.parse(s) as ChartDataPayload;
    if (!data || typeof data !== 'object') return null;
    if (!Array.isArray(data.labels) || !Array.isArray(data.valores)) return null;
    if (!data.labels.length || !data.valores.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function ChartBlock({ content, className = '' }: ChartBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parsed = parseChartJson(content);

  useEffect(() => {
    let chart: import('chart.js').Chart | null = null;

    const run = async () => {
      const data = parseChartJson(content);
      if (!data) return;

      const Chart = (await import('chart.js/auto')).default;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const colors = data.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

      if (data.tipo === 'pizza') {
        chart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: data.labels,
            datasets: [{
              data: data.valores,
              backgroundColor: colors,
              borderColor: '#fff',
              borderWidth: 1,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'bottom' },
              title: { display: !!data.titulo, text: data.titulo },
            },
          },
        });
      } else if (data.tipo === 'linha') {
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: [{
              label: data.titulo || 'Valores',
              data: data.valores,
              borderColor: CHART_COLORS[1],
              backgroundColor: 'rgba(0, 110, 255, 0.1)',
              fill: true,
              tension: 0.2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              title: { display: !!data.titulo, text: data.titulo },
            },
            scales: {
              y: { beginAtZero: true },
            },
          },
        });
      } else {
        chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.labels,
            datasets: [{
              label: data.titulo || 'Valores',
              data: data.valores,
              backgroundColor: colors,
              borderColor: 'rgba(15, 24, 35, 0.3)',
              borderWidth: 1,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              title: { display: !!data.titulo, text: data.titulo },
            },
            scales: {
              y: { beginAtZero: true },
            },
          },
        });
      }
    };

    run();
    return () => {
      chart?.destroy();
    };
  }, [content]);

  if (!parsed) {
    return (
      <figure className={`chart-block my-4 rounded border border-amber-200/80 bg-amber-50/50 p-3 text-sm text-amber-950/80 ${className}`}>
        <figcaption className="font-medium text-amber-900/90 mb-1">Gráfico (JSON inválido ou incompleto)</figcaption>
        <pre className="text-xs whitespace-pre-wrap break-words max-h-32 overflow-y-auto opacity-90">{content}</pre>
      </figure>
    );
  }

  return (
    <figure className={`chart-block my-4 ${className}`}>
      <div className="relative w-full" style={{ minHeight: 220 }}>
        <canvas ref={canvasRef} />
      </div>
    </figure>
  );
}
