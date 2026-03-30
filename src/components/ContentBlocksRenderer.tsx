'use client';

import React from 'react';
import { ChartBlock } from '@/components/ChartBlock';

export interface ContentBlockItem {
  type: 'text' | 'image' | 'mermaid' | 'chart';
  content: string;
}

interface ContentBlocksRendererProps {
  blocks: ContentBlockItem[];
  className?: string;
}

export function isBulletLine(line: string): boolean {
  const t = line.trimStart();
  return /^[•\-*]\s+/.test(t) || /^\d{1,2}[.)]\s+/.test(t);
}

export function stripBulletPrefix(line: string): string {
  return line.trimStart().replace(/^[•\-*]\s+/, '').replace(/^\d{1,2}[.)]\s+/, '');
}

/** Agrupa parágrafos e listas quando o texto usa linhas com "• " (material didático). */
function renderTextBlockContent(content: string, blockIndex: number) {
  const lines = content.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const nodes: React.ReactNode[] = [];
  let i = 0;
  let part = 0;
  while (i < lines.length) {
    if (isBulletLine(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && isBulletLine(lines[i])) {
        items.push(stripBulletPrefix(lines[i]));
        i += 1;
      }
      nodes.push(
        <ul key={`tb-${blockIndex}-ul-${part++}`} className="list-disc pl-5 space-y-1.5 my-3">
          {items.map((t, j) => (
            <li key={j}>{t}</li>
          ))}
        </ul>
      );
    } else {
      const paras: string[] = [];
      while (i < lines.length && !isBulletLine(lines[i])) {
        paras.push(lines[i]);
        i += 1;
      }
      paras.forEach((p, j) => {
        nodes.push(<p key={`tb-${blockIndex}-p-${part++}-${j}`}>{p}</p>);
      });
    }
  }
  return <>{nodes}</>;
}

/** Parágrafos e listas a partir de trechos já quebrados (ex.: split de bloco_principal). */
export function renderParagraphParts(parts: string[], keyPrefix: string): React.ReactNode {
  const trimmed = parts.map((s) => s.trim()).filter(Boolean);
  if (!trimmed.length) return null;
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let part = 0;
  while (i < trimmed.length) {
    if (isBulletLine(trimmed[i])) {
      const items: string[] = [];
      while (i < trimmed.length && isBulletLine(trimmed[i])) {
        items.push(stripBulletPrefix(trimmed[i]));
        i += 1;
      }
      nodes.push(
        <ul key={`${keyPrefix}-ul-${part++}`} className="list-disc pl-5 space-y-1.5 my-3">
          {items.map((t, j) => (
            <li key={j}>{t}</li>
          ))}
        </ul>
      );
    } else {
      nodes.push(<p key={`${keyPrefix}-p-${part++}`}>{trimmed[i]}</p>);
      i += 1;
    }
  }
  return <>{nodes}</>;
}

/**
 * Renderiza content_blocks do content-agent (mapeamento tipo → ferramenta):
 * - text → <p>
 * - image → placeholder (prompt em data-prompt; sem imagem real ainda)
 * - mermaid → Mermaid.js: <div class="mermaid">[código]</div>
 * - chart → Chart.js: gráfico barras/pizza/linha (relatório corporativo)
 */
export function ContentBlocksRenderer({ blocks, className = '' }: ContentBlocksRendererProps) {
  if (!blocks?.length) return null;

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          const hasBulletLines = block.content.split(/\n+/).some((line) => line.trim() && isBulletLine(line));
          return (
            <React.Fragment key={i}>
              {hasBulletLines ? (
                renderTextBlockContent(block.content, i)
              ) : (
                block.content
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((p, j) => <p key={`${i}-${j}`}>{p}</p>)
              )}
            </React.Fragment>
          );
        }
        if (block.type === 'image') {
          // Imagens do content-agent aqui são apenas prompts (não geramos imagem nesse fluxo).
          // Para não poluir o layout, não renderizamos nada.
          return null;
        }
        if (block.type === 'mermaid') {
          return (
            <div
              key={i}
              className="mermaid my-4 font-mono text-xs p-4 bg-slate-100 rounded overflow-x-auto"
              data-mermaid-code={block.content}
            >
              {block.content}
            </div>
          );
        }
        if (block.type === 'chart') {
          return <ChartBlock key={i} content={block.content} />;
        }
        return null;
      })}
    </div>
  );
}
