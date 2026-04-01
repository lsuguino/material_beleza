'use client';

import React from 'react';
import { PageCoverEditorial } from '@/components/pages/PageCoverEditorial';
import { PageContraCapa } from '@/components/pages/PageContraCapa';
import { PageIntro } from '@/components/pages/PageIntro';
import { PageDoubleColumn } from '@/components/pages/PageDoubleColumn';
import { PageSummary } from '@/components/pages/PageSummary';
import { renderParagraphParts, type ContentBlockItem } from '@/components/ContentBlocksRenderer';
import {
  normalizeContentBlocks,
  collectPageTextParts,
  collectConceptTextParts,
  shouldAppendPageTextFallback,
} from '@/lib/normalize-content-blocks';

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

/** Número da página (1-based) em que cada seção `conteudo` começa, na ordem do PDF/preview. */
function computeTocStartPages(paginas: PaginaDesign[]): number[] {
  const starts: number[] = [];
  let pageNum = 0;
  for (const p of paginas) {
    pageNum += 1;
    const tipo = p.tipo || 'conteudo';
    if (tipo === 'conteudo') starts.push(pageNum);
  }
  return starts;
}

/** Intro na 1ª página ou quando há sugestão de imagem; demais em duas colunas (texto corrido + exemplos à direita). */
function chooseEditorialTemplate(pagina: PaginaDesign, isFirstContent: boolean): 'intro' | 'double_column' {
  const layoutTipo = (pagina.layout_tipo || '').toString();
  if (layoutTipo === 'header_destaque' || layoutTipo === 'imagem_top' || layoutTipo === 'imagem_lateral') {
    return 'intro';
  }
  if (layoutTipo === 'dois_colunas' || layoutTipo === 'citacao_grande' || layoutTipo === 'lista_icones' || layoutTipo === 'dados_grafico') {
    return 'double_column';
  }
  const hasImageHint = Boolean(pagina.sugestao_imagem || pagina.prompt_imagem);
  if (isFirstContent || hasImageHint) return 'intro';
  return 'double_column';
}

export function MaterialPreviewBlocks({ data, className = '', scale = 0.4, renderPageWrapper }: MaterialPreviewBlocksProps) {
  if (!data || typeof data !== 'object') {
    return (
      <div className={`rounded-xl bg-white/10 border border-white/20 p-8 text-center text-white/70 min-h-[200px] flex items-center justify-center ${className}`}>
        Nenhum dado de material. Gere um material na página inicial.
      </div>
    );
  }
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
  const isVtsd =
    data.curso_id === 'geral' ||
    (tema.name || '').toLowerCase().includes('venda todo santo dia');
  const tocItems = paginas
    .filter((p) => (p.tipo || 'conteudo') === 'conteudo')
    .map((p) => (p.titulo_bloco ?? p.titulo ?? 'Conteúdo').toString());
  const tocStartPages = computeTocStartPages(paginas);

  // Numeração: mostrar apenas a partir da página seguinte ao Sumário
  const sumarioIndex = paginas.findIndex((p) => {
    const tipo = (p?.tipo || '').toString();
    return tipo === 'sumario_ref' || tipo === 'sumario';
  });

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

  let pageKeyCounter = 0;
  const wrapByKey = (node: React.ReactNode, key: number) => {
    const inner = (
      <div
        className={
          isVtsd
            ? 'shadow-sm rounded-sm overflow-hidden border border-neutral-200/90 bg-white print-editorial-page'
            : 'shadow-xl rounded-sm overflow-hidden border border-white/10 print-editorial-page'
        }
      >
        {node}
      </div>
    );
    if (renderPageWrapper) return <React.Fragment key={key}>{renderPageWrapper(inner, key)}</React.Fragment>;
    return (
      <div key={key} className="preview-page-wrap flex flex-col items-center shrink-0">
        {inner}
      </div>
    );
  };

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
        if (!pagina || typeof pagina !== 'object') return null;
        const tipo = pagina.tipo || 'conteudo';
        const contentBlocks = normalizeContentBlocks(pagina.content_blocks);
        const paragrafos = pagina.bloco_principal
          ? pagina.bloco_principal
              .split(/\n+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const bodyTextParts = collectPageTextParts(pagina);
        const conceptParts = collectConceptTextParts(pagina);
        const introParagraphs = conceptParts.length ? conceptParts : bodyTextParts;
        const titulo = (pagina.titulo ?? pagina.titulo_bloco) || 'Conteúdo';
        const isFirstContent = tipo === 'conteudo' && contentPageIndex === 0;
        if (tipo === 'conteudo') contentPageIndex += 1;

        const wrap = (node: React.ReactNode) => wrapByKey(node, pageKeyCounter++);
        const showPageNumber = sumarioIndex >= 0 ? index > sumarioIndex : index > 0;
        // Exibir numeração real do documento (mesma referência usada no sumário).
        const pageNumber = showPageNumber ? index + 1 : undefined;

        if (tipo === 'capa') {
          return wrap(
            <PageCoverEditorial
              title={pagina.titulo || tituloGeral}
              subtitle={pagina.subtitulo}
              nomeCurso={nomeCurso}
              primary={primary}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        if (tipo === 'contracapa') {
          return wrap(
            <PageContraCapa
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
            />
          );
        }

        if (tipo === 'intro_ref') {
          return wrap(
            <PageIntro
              title={titulo}
              paragraphs={introParagraphs}
              contentBlocks={contentBlocks}
              imagePlaceholder={pagina.sugestao_imagem || 'Imagem'}
              imagePrompt={pagina.prompt_imagem}
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        if (tipo === 'sumario_ref' || tipo === 'sumario') {
          return wrap(
            <PageSummary
              title="Sumário"
              items={tocItems}
              nomeCurso={nomeCurso}
              sidebarLabel="Conteúdo"
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        const template = chooseEditorialTemplate(pagina, isFirstContent);

        if (template === 'intro') {
          return wrap(
            <PageIntro
              title={titulo}
              paragraphs={introParagraphs}
              contentBlocks={contentBlocks}
              imagePlaceholder={pagina.sugestao_imagem || 'Imagem'}
              imagePrompt={pagina.prompt_imagem}
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        const destaquesList = (pagina.destaques as string[] | undefined)?.filter(Boolean) ?? [];

        if (contentBlocks.length) {
          const fallbackForBlocks =
            paragrafos.length > 0 ? paragrafos : conceptParts.length > 0 ? conceptParts : bodyTextParts;
          const needTextFallback = shouldAppendPageTextFallback(contentBlocks, fallbackForBlocks);
          const afterBlocks =
            needTextFallback && fallbackForBlocks.length
              ? renderParagraphParts(fallbackForBlocks, `pg-${index}-fb`)
              : undefined;
          const showDestaquesRight =
            Boolean(pagina.destaques?.length) && !(needTextFallback && !paragrafos.length);
          return wrap(
            <PageDoubleColumn
              title={titulo}
              contentBlocks={contentBlocks}
              afterBlocksContent={afterBlocks}
              rightContent={
                showDestaquesRight ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {pagina.destaques!.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : undefined
              }
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        const safeConcept =
          conceptParts.length > 0
            ? conceptParts
            : bodyTextParts.length > 0
              ? bodyTextParts
              : ['Conteúdo extraído do VTT não foi estruturado em parágrafos nesta seção.'];

        if (destaquesList.length > 0) {
          return wrap(
            <PageDoubleColumn
              title={titulo}
              leftContent={<>{renderParagraphParts(safeConcept, `pg-${index}-main`)}</>}
              rightContent={
                <ul className="list-disc pl-4 space-y-2">
                  {destaquesList.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              }
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        const mid = Math.ceil(safeConcept.length / 2);
        const leftParas = safeConcept.slice(0, mid);
        const rightParas = safeConcept.slice(mid);
        return wrap(
          <PageDoubleColumn
            title={titulo}
            leftContent={<>{renderParagraphParts(leftParas, `pg-${index}-L`)}</>}
            rightContent={<>{renderParagraphParts(rightParas, `pg-${index}-R`)}</>}
            nomeCurso={nomeCurso}
            primary={primary}
            accent={accent}
            pageNumber={pageNumber}
            showPageNumber={showPageNumber}
            variant={isVtsd ? 'vtsd' : 'default'}
          />
        );
      })}
    </div>
  );
}
