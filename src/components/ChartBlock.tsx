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

export function ChartBlock({ content, className = '' }: ChartBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: import('chart.js').Chart | null = null;

    const run = async () => {
      let data: ChartDataPayload;
      try {
        data = JSON.parse(content) as ChartDataPayload;
      } catch {
        return;
      }
      if (!data.labels?.length || !data.valores?.length) return;

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

  return (
    <figure className={`chart-block my-4 ${className}`}>
      <div className="relative w-full" style={{ minHeight: 220 }}>
        <canvas ref={canvasRef} />
      </div>
    </figure>
  );
}
