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

/**
 * Renderiza content_blocks do content-agent (mapeamento tipo → ferramenta):
 * - text → <p>
 * - image → DALL-E 3: <img src="pending" data-prompt="[IMAGE_PROMPT]">
 * - mermaid → Mermaid.js: <div class="mermaid">[código]</div>
 * - chart → Chart.js: gráfico barras/pizza/linha (relatório corporativo)
 */
export function ContentBlocksRenderer({ blocks, className = '' }: ContentBlocksRendererProps) {
  if (!blocks?.length) return null;

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          const paragraphs = block.content.split(/\n+/).filter(Boolean);
          return (
            <React.Fragment key={i}>
              {paragraphs.map((p, j) => (
                <p key={`${i}-${j}`}>{p}</p>
              ))}
            </React.Fragment>
          );
        }
        if (block.type === 'image') {
          return (
            <figure key={i} className="content-block-image my-4">
              <img
                src="pending"
                data-prompt={block.content}
                alt=""
                className="w-full min-h-[120px] bg-slate-200 object-cover"
              />
            </figure>
          );
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
