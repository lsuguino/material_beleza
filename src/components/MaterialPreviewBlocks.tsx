'use client';

import React from 'react';
import { PageCoverEditorial } from '@/components/pages/PageCoverEditorial';
import { PageSummary } from '@/components/pages/PageSummary';
import { PageIntro } from '@/components/pages/PageIntro';
import { PageDoubleColumn } from '@/components/pages/PageDoubleColumn';
import type { ContentBlockItem } from '@/components/ContentBlocksRenderer';

export type { ContentBlockItem };

export interface TemaPreview {
  name: string;
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
}

export interface PaginaDesign {
  tipo?: string;
  layout_tipo?: string;
  titulo?: string;
  subtitulo?: string;
  titulo_bloco?: string;
  bloco_principal?: string;
  /** Blocos ordenados: text, image (DALL-E 3), mermaid (Mermaid.js), chart (Chart.js) */
  content_blocks?: ContentBlockItem[];
  destaques?: string[];
  citacao?: string;
  dado_numerico?: string;
  cor_fundo_principal?: string;
  cor_fundo_destaque?: string;
  cor_texto_principal?: string;
  cor_texto_destaque?: string;
  proporcao_colunas?: string;
  sugestao_imagem?: string;
  prompt_imagem?: string;
  sugestao_grafico?: { tipo: string; titulo: string; labels: string[]; valores: number[] };
  sugestao_fluxograma?: { titulo: string; etapas: string[] };
  sugestao_tabela?: { titulo: string; colunas: string[]; linhas: string[][] };
  sugestao_icone?: string;
  itens?: string[];
  [key: string]: unknown;
}

export interface PreviewData {
  conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: PaginaDesign[] };
  design?: { titulo?: string; subtitulo_curso?: string; paginas?: PaginaDesign[] };
  tema?: TemaPreview;
  curso_id?: string;
}

interface MaterialPreviewBlocksProps {
  data: PreviewData;
  className?: string;
  scale?: number;
  /** Na rota /preview: envolve cada página com ref e classe para scroll/impressão */
  renderPageWrapper?: (pageNode: React.ReactNode, index: number) => React.ReactNode;
}

/** Decide template editorial: summary (lista numerada), intro (imagem topo), double_column */
function chooseEditorialTemplate(
  pagina: PaginaDesign,
  index: number,
  isFirstContent: boolean
): 'summary' | 'intro' | 'double_column' {
  const hasList = (pagina.destaques?.length ?? 0) >= 2 || (pagina.itens?.length ?? 0) >= 2;
  const hasImageHint = Boolean(pagina.sugestao_imagem || pagina.prompt_imagem);
  if (hasList && (pagina.titulo || pagina.titulo_bloco)) return 'summary';
  if (isFirstContent || hasImageHint) return 'intro';
  return 'double_column';
}

export function MaterialPreviewBlocks({ data, className = '', scale = 0.4, renderPageWrapper }: MaterialPreviewBlocksProps) {
  const design = data.design || data.conteudo;
  const tema = data.tema || {
    name: 'Curso',
    primary: '#0f1823',
    primaryLight: '#1e293b',
    primaryDark: '#0f1823',
    accent: '#006eff',
  };
  // Aceitar "paginas" ou "pages" (resposta da IA pode variar)
  const rawPaginas = design?.paginas ?? (design as { pages?: PaginaDesign[] })?.pages;
  const paginas = Array.isArray(rawPaginas) ? rawPaginas : [];
  const nomeCurso = tema.name || (design as { subtitulo_curso?: string })?.subtitulo_curso || 'Material';
  const tituloGeral = design?.titulo || 'Material gerado';
  const primary = tema.primary ?? '#0f1823';
  const accent = tema.accent ?? tema.primary ?? '#006eff';

  if (paginas.length === 0) {
    return (
      <div className={`rounded-xl bg-white/10 border border-white/20 p-8 text-center text-white/70 min-h-[200px] flex items-center justify-center ${className}`}>
        Nenhuma página no material. Verifique se a geração retornou conteúdo.
      </div>
    );
  }

  let contentPageIndex = 0;

  // Garantir área rolável quando scale < 1 (transform não altera layout flow)
  const minHeight = scale < 1 ? Math.max(400, paginas.length * 320) : undefined;

  return (
    <div
      className={`flex flex-col items-center gap-4 ${className}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        minHeight,
      }}
    >
      {paginas.map((pagina, index) => {
        const tipo = pagina.tipo || 'conteudo';
        const contentBlocks = pagina.content_blocks as ContentBlockItem[] | undefined;
        const paragrafos = pagina.bloco_principal
          ? pagina.bloco_principal.split(/\n+/).filter(Boolean)
          : pagina.bloco_principal ? [pagina.bloco_principal] : [];
        const titulo = (pagina.titulo ?? pagina.titulo_bloco) || 'Conteúdo';
        const isFirstContent = tipo === 'conteudo' && contentPageIndex === 0;
        if (tipo === 'conteudo') contentPageIndex += 1;

        const wrap = (node: React.ReactNode) => {
          const inner = (
            <div className="shadow-xl rounded-sm overflow-hidden border border-white/10 print-editorial-page">
              {node}
            </div>
          );
          if (renderPageWrapper) return <React.Fragment key={index}>{renderPageWrapper(inner, index)}</React.Fragment>;
          return (
            <div key={index} className="preview-page-wrap flex flex-col items-center shrink-0">
              {inner}
            </div>
          );
        };

        if (tipo === 'capa') {
          return wrap(
            <PageCoverEditorial
              title={pagina.titulo || tituloGeral}
              subtitle={pagina.subtitulo}
              nomeCurso={nomeCurso}
              primary={primary}
            />
          );
        }

        const template = chooseEditorialTemplate(pagina, index, isFirstContent);

        if (template === 'summary') {
          const items = pagina.destaques?.length
            ? pagina.destaques
            : (pagina.itens as string[] | undefined) ?? paragrafos.slice(0, 8);
          return wrap(
            <PageSummary
              title={titulo}
              items={items.length ? items : ['Conteúdo em lista.']}
              sidebarLabel={nomeCurso}
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
            />
          );
        }

        if (template === 'intro') {
          return wrap(
            <PageIntro
              title={titulo}
              paragraphs={paragrafos.length ? paragrafos : undefined}
              contentBlocks={contentBlocks}
              imagePlaceholder={pagina.sugestao_imagem || 'Imagem'}
              imagePrompt={pagina.prompt_imagem}
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
            />
          );
        }

        if (contentBlocks?.length) {
          return wrap(
            <PageDoubleColumn
              title={titulo}
              contentBlocks={contentBlocks}
              rightContent={pagina.destaques?.length ? <ul className="list-disc pl-4 space-y-1">{pagina.destaques.map((d, i) => <li key={i}>{d}</li>)}</ul> : undefined}
              nomeCurso={nomeCurso}
              primary={primary}
            />
          );
        }

        const mid = Math.ceil(paragrafos.length / 2);
        const leftParas = paragrafos.slice(0, mid);
        const rightParas = paragrafos.slice(mid);
        return wrap(
          <PageDoubleColumn
            title={titulo}
            leftContent={
              <>
                {leftParas.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </>
            }
            rightContent={
              <>
                {rightParas.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </>
            }
            nomeCurso={nomeCurso}
            primary={primary}
          />
        );
      })}
    </div>
  );
}
