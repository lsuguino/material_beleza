'use client';

import React from 'react';
import { PageCoverEditorial } from '@/components/pages/PageCoverEditorial';
import { PageContraCapa } from '@/components/pages/PageContraCapa';
import { PageIntro } from '@/components/pages/PageIntro';
import { PageDoubleColumn } from '@/components/pages/PageDoubleColumn';
import { PageSummary } from '@/components/pages/PageSummary';
import { renderParagraphParts, type ContentBlockItem } from '@/components/ContentBlocksRenderer';
import { isRenderableImageUrl } from '@/lib/image-url';
import {
  normalizeContentBlocks,
  collectPageTextParts,
  collectConceptTextParts,
  shouldAppendPageTextFallback,
} from '@/lib/normalize-content-blocks';
import {
  enrichPaginaImageHints,
  mergeDesignPageWithConteudo,
} from '@/lib/preview-page-merge';
// Nota: PageConteudo não é mais consumido por MaterialPreviewBlocks após migração para
// FigmaTemplateRenderer (política de fidelidade Figma — ver PR "Figma fiel no app").
import { PageConclusaoVtsd } from '@/components/pages/PageConclusaoVtsd';
import { PageAtividadesFinais } from '@/components/pages/PageAtividadesFinais';
import { renderFigmaTemplate, type TemplateProps } from '@/components/pages/FigmaTemplateRenderer';

/**
 * Coerce qualquer valor pra string segura — defesa contra dados antigos do IDB
 * onde o LLM (ou um fluxo legado) pode ter retornado objetos `{tipo, titulo, conteudo}`
 * em campos esperados como string. Sem isso, React crasha ao renderizar objeto como child.
 */
function coerceToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const fallback = o.conteudo ?? o.content ?? o.titulo ?? o.title ?? o.text ?? '';
    return String(fallback);
  }
  return String(v);
}

function coerceToStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(coerceToString).filter((s) => s.length > 0);
}
import type { LayoutTipo } from '@/lib/design-agent';

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
  /** Data URL após geração Gemini (Nano Banana) */
  imagem_url?: string;
  sugestao_grafico?: { tipo: string; titulo: string; labels: string[]; valores: number[] };
  sugestao_fluxograma?: { titulo: string; etapas: string[] };
  sugestao_tabela?: { titulo: string; colunas: string[]; linhas: string[][] };
  sugestao_icone?: string;
  itens?: string[];
  /** Se true, página é continuação do mesmo capítulo (excluída do sumário como entrada nova). */
  continuacao?: boolean;
  /** Índice do capítulo no sumário (1-based); repetido em todas as partes de um capítulo paginado. */
  capitulo_seq?: number;
  [key: string]: unknown;
}

export interface PreviewData {
  conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: PaginaDesign[] };
  design?: { titulo?: string; subtitulo_curso?: string; paginas?: PaginaDesign[] };
  tema?: TemaPreview;
  curso_id?: string;
  /** Perguntas de estudo geradas na primeira etapa (opção do formulário). */
  perguntas?: string[];
}

interface MaterialPreviewBlocksProps {
  data: PreviewData;
  className?: string;
  scale?: number;
  /** Na rota /preview: envolve cada página com ref e classe para scroll/impressão */
  renderPageWrapper?: (pageNode: React.ReactNode, index: number) => React.ReactNode;
  /** Quando definido, renderiza apenas a página neste índice (0-based). Usado para miniaturas. */
  singlePageIndex?: number;
}

/** Intro na 1ª página ou quando há sugestão de imagem; demais em duas colunas (texto corrido + exemplos à direita). */
function chooseEditorialTemplate(pagina: PaginaDesign, isFirstContent: boolean): 'intro' | 'double_column' {
  const layoutTipo = (pagina.layout_tipo || '').toString();
  if (layoutTipo.startsWith('A4_')) {
    return 'intro';
  }
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

function deriveVtsdParagraphFallback(pagina: PaginaDesign, baseParagraphs: string[]): string[] {
  const cleanedBase = baseParagraphs.map((p) => String(p || '').trim()).filter(Boolean);
  if (cleanedBase.length > 0) return cleanedBase;

  const candidates: string[] = [];
  const pushIfNew = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return;
    if (!candidates.includes(text)) candidates.push(text);
  };

  (pagina.destaques || []).forEach(pushIfNew);
  pushIfNew(pagina.citacao);
  (pagina.itens || []).forEach(pushIfNew);
  pushIfNew(pagina.subtitulo);

  if (candidates.length > 0) return candidates.slice(0, 6);
  return ['Conteúdo em preparação para esta página.'];
}

export function MaterialPreviewBlocks({ data, className = '', scale = 0.4, renderPageWrapper, singlePageIndex }: MaterialPreviewBlocksProps) {
  if (!data || typeof data !== 'object') {
    return (
      <div className={`rounded-xl bg-white/10 border border-white/20 p-8 text-center text-white/70 min-h-[200px] flex items-center justify-center ${className}`}>
        Nenhum dado de material. Gere um material na página inicial.
      </div>
    );
  }
  const design = data.design || data.conteudo;
  const conteudoFonte = data.conteudo?.paginas;
  const tema = data.tema || {
    name: 'Curso',
    primary: '#0f1823',
    primaryLight: '#1e293b',
    primaryDark: '#0f1823',
    accent: '#006eff',
  };
  // Aceitar "paginas" ou "pages" (resposta da IA pode variar)
  const rawPaginas = design?.paginas ?? (design as { pages?: PaginaDesign[] })?.pages;
  const paginas = Array.isArray(rawPaginas)
    ? rawPaginas.map((p, i) =>
        enrichPaginaImageHints(mergeDesignPageWithConteudo(p, conteudoFonte?.[i]))
      )
    : [];
  const nomeCurso = tema.name || (design as { subtitulo_curso?: string })?.subtitulo_curso || 'Material';
  const tituloGeral = design?.titulo || 'Material gerado';
  const primary = tema.primary ?? '#0f1823';
  const accent = tema.accent ?? tema.primary ?? '#006eff';
  const isVtsd =
    data.curso_id === 'geral' ||
    (tema.name || '').toLowerCase().includes('venda todo santo dia');
  /**
   * Sumário: lista páginas de conteúdo não-continuação, DEDUPANDO entradas consecutivas
   * com o mesmo titulo_bloco. Isso evita "opener + content" aparecendo 2x pro mesmo assunto
   * (o opener injetado em `injectTopicOpeners` tem o mesmo titulo da primeira página do tópico).
   */
  const tocItems: string[] = [];
  const tocStartPages: number[] = [];
  {
    let pageNum = 0;
    let lastTitle = '';
    for (const p of paginas) {
      pageNum += 1;
      const tipo = p.tipo || 'conteudo';
      if (tipo !== 'conteudo' || p.continuacao) continue;
      const raw = (p.titulo_bloco ?? p.titulo ?? '').toString().trim();
      const title = raw || `Seção ${tocItems.length + 1}`;
      if (title === lastTitle) continue;
      tocItems.push(title);
      tocStartPages.push(pageNum);
      lastTitle = title;
    }
  }

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
            ? 'shadow-sm rounded-sm overflow-hidden border border-neutral-200/90 print-editorial-page'
            : 'shadow-xl rounded-sm overflow-hidden border border-white/10 print-editorial-page'
        }
        style={isVtsd ? { backgroundColor: '#C4C4C4' } : undefined}
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
      className={`material-preview-stack flex flex-col items-center gap-4 ${className}`}
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
        // Split bloco_principal into paragraphs (double newlines = paragraph break)
        // Single newlines within a paragraph are joined with space (keep paragraph together)
        const paragrafos = pagina.bloco_principal
          ? pagina.bloco_principal
              .split(/\n\s*\n/)
              .map((block) => block.split(/\n/).map((l) => l.trim()).filter(Boolean).join(' '))
              .map((s) => s.trim())
              .filter(Boolean)
              // Filter out lines that are just numbered list items (handled by itens/destaques)
              .filter((s) => !/^\d+[.)]\s*$/.test(s))
          : [];
        const bodyTextParts = collectPageTextParts(pagina);
        const conceptParts = collectConceptTextParts(pagina);
        const introParagraphs = conceptParts.length ? conceptParts : bodyTextParts;
        const titulo = String((pagina.titulo ?? pagina.titulo_bloco) ?? '').trim();
        const isFirstContent = tipo === 'conteudo' && contentPageIndex === 0;
        const capSeq = typeof pagina.capitulo_seq === 'number' && pagina.capitulo_seq > 0 ? pagina.capitulo_seq : null;
        const capituloNumero =
          tipo === 'conteudo' ? (capSeq ?? contentPageIndex + 1) : 1;
        if (tipo === 'conteudo') {
          if (capSeq == null) contentPageIndex += 1;
        }

        const wrap = (node: React.ReactNode) => wrapByKey(node, pageKeyCounter++);

        // Miniatura de página única: pular todas as outras
        if (singlePageIndex != null && index !== singlePageIndex) return null;

        const showPageNumber = sumarioIndex >= 0 ? index > sumarioIndex : index > 0;
        // Exibir numeração real do documento (mesma referência usada no sumário).
        const pageNumber = showPageNumber ? index + 1 : undefined;

        if (tipo === 'capa') {
          const capaBloco = typeof pagina.bloco_principal === 'string' ? pagina.bloco_principal.trim() : '';
          const capaExcerpt =
            capaBloco.split(/\n\s*\n/).find((s) => s.trim().length > 0)?.trim().slice(0, 720) ||
            capaBloco.slice(0, 720);
          return wrap(
            <PageCoverEditorial
              title={pagina.titulo || tituloGeral}
              subtitle={pagina.subtitulo}
              nomeCurso={nomeCurso}
              primary={primary}
              pageNumber={isVtsd ? index + 1 : pageNumber}
              showPageNumber={isVtsd ? false : showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
              excerpt={capaExcerpt || undefined}
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

        const heroImageUrl = isRenderableImageUrl(pagina.imagem_url) ? pagina.imagem_url.trim() : undefined;

        if (tipo === 'intro_ref') {
          return wrap(
            <PageIntro
              title={titulo}
              paragraphs={isVtsd ? [] : introParagraphs}
              contentBlocks={contentBlocks}
              imagePlaceholder={pagina.sugestao_imagem || 'Imagem'}
              imagePrompt={pagina.prompt_imagem}
              imageUrl={heroImageUrl}
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
              vtsdWelcome={isVtsd}
            />
          );
        }

        if (tipo === 'sumario_ref' || tipo === 'sumario') {
          return wrap(
            <PageSummary
              title="Sumário"
              items={tocItems}
              startPages={tocStartPages}
              nomeCurso={nomeCurso}
              primary={primary}
              accent={accent}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        if (tipo === 'atividades_finais') {
          const rawQs = (pagina as { perguntas?: unknown }).perguntas;
          const qs = Array.isArray(rawQs) ? rawQs.map((s) => String(s)) : [];
          const lr = (pagina as { linhas_resposta?: unknown }).linhas_resposta;
          const linhas = typeof lr === 'number' && lr > 0 ? lr : 5;
          return wrap(
            <PageAtividadesFinais
              questions={qs}
              answerLines={linhas}
              primary={primary}
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              variant={isVtsd ? 'vtsd' : 'default'}
            />
          );
        }

        if (tipo === 'conclusao_ref' && isVtsd) {
          const blocoConclusao =
            typeof pagina.bloco_principal === 'string' ? pagina.bloco_principal.trim() : '';
          return wrap(
            <PageConclusaoVtsd
              pageNumber={pageNumber}
              showPageNumber={showPageNumber}
              titulo={(pagina.titulo ?? pagina.titulo_bloco ?? 'Conclusão').toString()}
              blocoPrincipal={blocoConclusao || undefined}
            />
          );
        }

        if (isVtsd && tipo === 'conteudo') {
          // VTSD: usar APENAS FigmaTemplateRenderer. Layouts sem renderer caem em
          // TemplateInertFallback (B1) dentro do renderer — nunca aproxima silenciosamente.
          // Ver docs/figma-source-of-truth.json + src/components/pages/FigmaTemplateRenderer.tsx.
          const rawLt = ((pagina.layout_tipo as string) || '').trim();
          const hasGeneratedImage = isRenderableImageUrl(pagina.imagem_url as string | undefined);
          // Coerção mínima: layout não-A4 (legado/legacy non-VTSD) → conteudo_misto ou magazine se há imagem.
          // Esta é a ÚNICA coerção permitida; qualquer A4_* entra direto no renderer.
          let lt: LayoutTipo;
          if (!rawLt.startsWith('A4_')) {
            lt = hasGeneratedImage ? 'A4_4_magazine' : 'A4_2_conteudo_misto';
          } else {
            lt = rawLt as LayoutTipo;
          }
          // Se o layout depende de imagem, mas a página não tem mídia, cai para texto corrido
          // para aproveitar melhor a área útil e evitar grandes blocos vazios.
          if (!hasGeneratedImage && (lt === 'A4_2_imagem_texto' || lt === 'A4_2_texto_imagem')) {
            lt = 'A4_2_texto_corrido';
          }
          const figmaParagraphs = deriveVtsdParagraphFallback(
            pagina,
            paragrafos.length > 0 ? paragrafos : introParagraphs,
          );
          return wrap(renderFigmaTemplate(lt, {
            titulo: coerceToString(titulo),
            subtitulo: coerceToString(pagina.subtitulo) || undefined,
            paragrafos: coerceToStringArray(figmaParagraphs),
            destaques: coerceToStringArray(pagina.destaques),
            citacao: coerceToString(pagina.citacao) || undefined,
            itens: coerceToStringArray(pagina.itens),
            numeroPagina: pageNumber ?? index + 1,
            imagemUrl: heroImageUrl,
            capituloNumero,
            iconId: coerceToString(pagina.icone_sugerido) || undefined,
            // Visuais estruturados — usados pelos templates novos (tabela, comparativo, prós/contras)
            sugestaoTabela: pagina.sugestao_tabela as TemplateProps['sugestaoTabela'],
            sugestaoGrafico: pagina.sugestao_grafico as TemplateProps['sugestaoGrafico'],
            sugestaoFluxograma: pagina.sugestao_fluxograma as TemplateProps['sugestaoFluxograma'],
            // Posição livre da imagem (layout A4_imagem_livre)
            imagemBox: pagina.imagem_box as TemplateProps['imagemBox'],
          }));
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
              imageUrl={heroImageUrl}
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
