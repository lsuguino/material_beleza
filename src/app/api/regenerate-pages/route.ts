import { NextRequest, NextResponse } from 'next/server';
import {
  extractPageText,
  extractVisualBlocks,
  extractVisualMeta,
  enrichPageFromTranscription,
  type ModoContent,
} from '@/lib/content-agent';
import { COURSE_THEMES, type CourseId } from '@/lib/courseThemes';
import { VTSD_COLOR } from '@/lib/vtsd-design-system';
import { budgetCharsForLayout, splitBlocoPrincipalIntoChunks } from '@/lib/paginate-content-pages';
import { TRANSCRIPTION_MAX_CHARS } from '@/lib/api-payload-limits';
import { ensureOpenRouterKey } from '@/lib/ensure-env';

export const maxDuration = 120;

type TemaPayload = {
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  backgroundColor?: string;
};

interface RegenerateRequest {
  existingData: {
    conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    design?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    tema?: TemaPayload;
    curso_id?: string;
    perguntas?: string[];
  };
  pageIndices: number[];
  curso_id: string;
  modo?: string;
  transcription?: string;
}

const NON_CONTENT_TYPES = new Set([
  'capa', 'contracapa', 'sumario_ref', 'sumario', 'intro_ref', 'conclusao_ref', 'atividades_finais',
]);

function isContentPage(page: Record<string, unknown>): boolean {
  const tipo = (page.tipo as string) || 'conteudo';
  return !NON_CONTENT_TYPES.has(tipo);
}

/** Caracteres de texto principal de uma página */
function pageTextLength(page: Record<string, unknown>): number {
  return extractPageText(page).length;
}

/** Limiar: página "esparsa" = menos de 40% do budget do layout preenchido */
function isSparse(page: Record<string, unknown>): boolean {
  const layout = (page.layout_tipo as string) || 'A4_2_conteudo_misto';
  const budget = budgetCharsForLayout(layout);
  const textLen = pageTextLength(page);
  return textLen < budget * 0.4;
}

/** Limiar: página "cheia demais" = mais de 95% do budget */
function isOverfilled(page: Record<string, unknown>): boolean {
  const layout = (page.layout_tipo as string) || 'A4_2_conteudo_misto';
  const budget = budgetCharsForLayout(layout);
  const textLen = pageTextLength(page);
  return textLen > budget * 0.95;
}

// ─── Layout selection ───

const VTSD_CONTENT_LAYOUTS = [
  'A4_2_conteudo_misto',
  'A4_2_texto_corrido',
  'A4_2_texto_citacao',
  'A4_2_texto_sidebar',
  'A4_3_sidebar_steps',
  'A4_4_magazine',
  'A4_7_sidebar_conteudo',
] as const;

function pickBestLayout(
  page: Record<string, unknown>,
  previousLayout: string | null,
  hasVisuals: boolean,
): string {
  const itens = Array.isArray(page.itens) ? page.itens : [];
  const itensCount = itens.length;
  const citacao = String(page.citacao ?? '').trim();
  const textLen = String(page.bloco_principal ?? '').length;

  const candidates: Array<{ layout: string; score: number }> = [];
  for (const layout of VTSD_CONTENT_LAYOUTS) {
    if (layout === previousLayout) continue;
    let score = 1;
    const budget = budgetCharsForLayout(layout);
    const ratio = textLen / budget;
    if (ratio >= 0.5 && ratio <= 1.0) score += 3;
    else if (ratio >= 0.3 && ratio <= 1.2) score += 1;
    else score -= 2;
    if (layout === 'A4_3_sidebar_steps' && itensCount >= 4) score += 4;
    if (layout === 'A4_7_sidebar_conteudo' && itensCount >= 2) score += 3;
    if (layout === 'A4_2_texto_citacao' && citacao.length > 10) score += 3;
    if (layout === 'A4_4_magazine' && hasVisuals) score += 3;
    if (layout === 'A4_2_texto_corrido' && !citacao && itensCount === 0) score += 1;
    if (layout === 'A4_2_conteudo_misto' && itensCount >= 2) score += 2;
    if (layout === 'A4_2_conteudo_misto' && citacao.length > 0) score += 1;
    candidates.push({ layout, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.layout || 'A4_2_conteudo_misto';
}

function splitByParagraphBoundary(text: string, maxChars: number): { head: string; tail: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const paras = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length < 2) return null;

  let head = '';
  for (let i = 0; i < paras.length; i++) {
    const para = paras[i];
    const candidate = head ? `${head}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      head = candidate;
      continue;
    }
    if (!head) return null;
    const tail = paras.slice(i).join('\n\n').trim();
    return tail ? { head: head.trim(), tail } : null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegenerateRequest;
    const { existingData, pageIndices, curso_id, modo, transcription: transcriptionRaw } = body;
    const transcription =
      typeof transcriptionRaw === 'string'
        ? transcriptionRaw.slice(0, TRANSCRIPTION_MAX_CHARS)
        : undefined;

    if (!existingData || !Array.isArray(pageIndices) || pageIndices.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    const designData = existingData.design || existingData.conteudo;
    const conteudoData = existingData.conteudo;
    if (!designData?.paginas || !Array.isArray(designData.paginas)) {
      return NextResponse.json({ error: 'Dados do material inválidos.' }, { status: 400 });
    }

    const paginas = designData.paginas;
    const cursoId = curso_id || existingData.curso_id || 'geral';
    const modoContent: ModoContent = modo === 'resumido' ? 'resumido' : 'completo';
    const isVtsd = cursoId === 'geral' || (existingData.tema?.name || '').toLowerCase().includes('venda todo santo dia');

    const builtInTheme = COURSE_THEMES[cursoId as CourseId];
    const tema = existingData.tema || {
      name: builtInTheme?.name || cursoId,
      primary: builtInTheme?.primary || '#135bec',
      primaryLight: builtInTheme?.primaryLight || '#3b82f6',
      primaryDark: builtInTheme?.primaryDark || '#1e40af',
      accent: builtInTheme?.accent || '#0ea5e9',
      backgroundColor: builtInTheme?.backgroundColor || '#F8F7E8',
    };

    // ─── ETAPA 1: Expansão inteligente ───
    // Incluir automaticamente vizinhas (anterior/seguinte) se são de conteúdo
    // e estão esparsas ou super-cheias — melhorar a distribuição no grupo
    const selectedSet = new Set(
      pageIndices.filter((i) => i >= 0 && i < paginas.length && isContentPage(paginas[i])),
    );

    for (const idx of [...selectedSet]) {
      // Vizinha anterior
      const prev = idx - 1;
      if (prev >= 0 && isContentPage(paginas[prev]) && !selectedSet.has(prev)) {
        if (isSparse(paginas[prev]) || isOverfilled(paginas[prev])) {
          selectedSet.add(prev);
        }
      }
      // Vizinha seguinte
      const next = idx + 1;
      if (next < paginas.length && isContentPage(paginas[next]) && !selectedSet.has(next)) {
        if (isSparse(paginas[next]) || isOverfilled(paginas[next])) {
          selectedSet.add(next);
        }
      }
    }

    const validIndices = Array.from(selectedSet).sort((a, b) => a - b);
    if (validIndices.length === 0) {
      return NextResponse.json({ error: 'Nenhuma página válida para reorganizar.' }, { status: 400 });
    }

    // ─── ETAPA 2: Coletar conteúdo das páginas selecionadas ───
    interface CollectedPage {
      originalIndex: number;
      tituloBloco: string;
      subtitulo: string;
      text: string;
      itens: string[];
      destaques: string[];
      citacao: string;
      sugestao_tabela?: Record<string, unknown>;
      visualBlocks: Array<Record<string, unknown>>;
      visualMeta: Record<string, unknown>;
    }

    const collected: CollectedPage[] = [];
    for (const idx of validIndices) {
      const page = paginas[idx];
      collected.push({
        originalIndex: idx,
        tituloBloco: String(page.titulo_bloco ?? ''),
        subtitulo: String(page.subtitulo ?? ''),
        text: extractPageText(page),
        itens: Array.isArray(page.itens) ? (page.itens as string[]).map(String).filter(Boolean) : [],
        destaques: Array.isArray(page.destaques) ? (page.destaques as string[]).map(String).filter(Boolean) : [],
        citacao: String(page.citacao ?? ''),
        sugestao_tabela:
          page.sugestao_tabela && typeof page.sugestao_tabela === 'object'
            ? (page.sugestao_tabela as Record<string, unknown>)
            : undefined,
        visualBlocks: extractVisualBlocks(page),
        visualMeta: extractVisualMeta(page),
      });
    }

    // ─── ETAPA 3: Enriquecer páginas esparsas com a transcrição ───
    const hasTranscription = transcription && transcription.length > 50;
    if (hasTranscription) {
      await ensureOpenRouterKey();

      const sparsePages = collected.filter((p) => {
        const layout = (paginas[p.originalIndex].layout_tipo as string) || 'A4_2_conteudo_misto';
        const budget = budgetCharsForLayout(layout);
        return p.text.length < budget * 0.5;
      });

      // Enriquecer em paralelo (máx 3 simultâneas para evitar rate limit)
      const enrichBatch = sparsePages.slice(0, 3);
      const enrichResults = await Promise.allSettled(
        enrichBatch.map((p) =>
          enrichPageFromTranscription(p.text, p.tituloBloco, transcription!, modoContent),
        ),
      );

      for (let i = 0; i < enrichBatch.length; i++) {
        const result = enrichResults[i];
        if (result.status === 'fulfilled') {
          const enriched = result.value;
          const target = enrichBatch[i];
          // Só atualizar se o texto enriquecido é mais longo
          if (enriched.bloco_principal.length > target.text.length) {
            target.text = enriched.bloco_principal;
          }
          if (enriched.itens.length > target.itens.length) {
            target.itens = enriched.itens;
          }
          if (enriched.destaques.length > target.destaques.length) {
            target.destaques = enriched.destaques;
          }
          if (enriched.citacao && enriched.citacao.length > target.citacao.length) {
            target.citacao = enriched.citacao;
          }
          if (enriched.sugestao_tabela && typeof enriched.sugestao_tabela === 'object') {
            target.sugestao_tabela = enriched.sugestao_tabela as Record<string, unknown>;
          }
        }
      }
    }

    // ─── ETAPA 4: Redistribuir e possivelmente eliminar páginas ───
    // Juntar todo o texto das páginas coletadas
    const allText = collected.map((p) => p.text).filter(Boolean).join('\n\n');
    const totalChars = allText.length;

    // Juntar todos os visuais e metadados
    const allVisualBlocks = collected.flatMap((p) => p.visualBlocks);
    const allVisualMetas = collected.map((p) => p.visualMeta).filter((m) => Object.keys(m).length > 0);

    // Calcular quantas páginas realmente precisamos
    // Usar um budget médio para estimar
    const avgBudget = 580; // budget médio dos layouts VTSD
    const idealPageCount = Math.max(1, Math.ceil(totalChars / (avgBudget * 0.75)));
    const newPageCount = Math.min(validIndices.length, Math.max(idealPageCount, 1));

    // Juntar títulos dos tópicos (manter os tópicos únicos)
    const uniqueTopics: Array<{ titulo: string; subtitulo: string }> = [];
    const seenTitulos = new Set<string>();
    for (const c of collected) {
      const cleanTitulo = String(c.tituloBloco || '').trim();
      const cleanSubtitulo = String(c.subtitulo || '').trim();
      if (cleanTitulo && !seenTitulos.has(cleanTitulo)) {
        seenTitulos.add(cleanTitulo);
        uniqueTopics.push({ titulo: cleanTitulo, subtitulo: cleanSubtitulo });
      }
    }

    // Escolher layouts para as novas páginas
    let prevLayout: string | null = null;
    if (validIndices[0] > 0) {
      prevLayout = (paginas[validIndices[0] - 1].layout_tipo as string) || null;
    }

    const targetLayouts: string[] = [];
    for (let i = 0; i < newPageCount; i++) {
      const hasVisuals = i < allVisualMetas.length;
      const tempPage: Record<string, unknown> = {
        bloco_principal: 'x'.repeat(Math.ceil(totalChars / newPageCount)),
        itens: collected[i]?.itens || [],
        citacao: collected[i]?.citacao || '',
      };
      const layout = isVtsd ? pickBestLayout(tempPage, prevLayout, hasVisuals) : 'header_destaque';
      targetLayouts.push(layout);
      prevLayout = layout;
    }

    // Dividir texto em chunks para as páginas
    const chunks: string[] = [];
    let remaining = allText;
    let effectivePageCount = newPageCount;

    for (let i = 0; i < newPageCount; i++) {
      if (i === newPageCount - 1) {
        chunks.push(remaining);
        break;
      }
      const layoutBudget = budgetCharsForLayout(targetLayouts[i]);
      const idealPerPage = Math.ceil(remaining.length / (newPageCount - i));
      const targetLen = Math.min(layoutBudget, Math.max(idealPerPage, 200));
      const parts = splitBlocoPrincipalIntoChunks(remaining, targetLen);

      if (parts.length > 1) {
        chunks.push(parts[0] || '');
        remaining = parts.slice(1).join('\n\n');
        continue;
      }

      const single = String(parts[0] ?? '').trim();
      const remainingTrimmed = remaining.trim();

      // Prioriza quebra por parágrafo inteiro: se não cabe nesta página, passa para a próxima.
      const byParagraph = splitByParagraphBoundary(remainingTrimmed, targetLen);
      if (byParagraph) {
        chunks.push(byParagraph.head);
        remaining = byParagraph.tail;
        continue;
      }

      // Se o conteúdo ainda está acima do volume da página atual, não força nesta página:
      // deixa para a próxima, preservando o parágrafo inteiro.
      if (remainingTrimmed.length > layoutBudget && i < newPageCount - 1) {
        continue;
      }

      // Fallback final: mantém texto inteiro no chunk atual (sem truncar/perder).
      chunks.push(remainingTrimmed);
      remaining = '';
      break;
    }

    // Mantém apenas páginas efetivamente preenchidas após a redistribuição.
    effectivePageCount = Math.max(1, chunks.length);

    // ─── ETAPA 5: Construir páginas reorganizadas ───
    const newDesignPaginas = [...paginas];
    const newConteudoPaginas = conteudoData?.paginas ? [...conteudoData.paginas] : null;

    // Páginas que vamos preencher
    const indicesToKeep = validIndices.slice(0, effectivePageCount);
    // Páginas que vamos remover (extras que foram consolidadas)
    const indicesToRemove = validIndices.slice(effectivePageCount);

    // Preencher as páginas que ficam
    for (let i = 0; i < indicesToKeep.length; i++) {
      const idx = indicesToKeep[i];
      const chunk = chunks[i] || '';
      const layout = targetLayouts[i];

      // Atribuir tópico apenas quando existir título válido.
      const topic = i < uniqueTopics.length ? uniqueTopics[i] : undefined;

      // Itens/destaques/citação — distribuir entre as páginas
      const sourceIdx = Math.min(i, collected.length - 1);
      const source = collected[sourceIdx];

      // content_blocks
      const contentBlocks: Array<Record<string, unknown>> = [];
      if (chunk) contentBlocks.push({ type: 'text', content: chunk });
      // Distribuir visuais: cada página pode ter 1
      if (i < allVisualBlocks.length) {
        contentBlocks.push(allVisualBlocks[i]);
      }

      // Design fields
      const designFields: Record<string, unknown> = isVtsd
        ? {
            layout_tipo: layout,
            cor_fundo_principal: VTSD_COLOR.fundo_page,
            cor_fundo_destaque: VTSD_COLOR.primary_darker,
            cor_texto_principal: VTSD_COLOR.texto_800,
            cor_texto_destaque: '#FFFFFF',
            icone_sugerido: 'article',
            usar_barra_lateral: false,
            usar_faixa_decorativa: false,
          }
        : {
            layout_tipo: layout,
            cor_fundo_principal: tema.backgroundColor || '#F8F7E8',
            cor_fundo_destaque: tema.accent || tema.primary,
            cor_texto_principal: '#1a1a1a',
            cor_texto_destaque: '#FFFFFF',
            icone_sugerido: 'article',
            usar_barra_lateral: true,
            usar_faixa_decorativa: true,
          };

      // Visual meta — distribuir entre as páginas
      const vMeta = i < allVisualMetas.length ? allVisualMetas[i] : {};

      const existingPage = paginas[idx];
      const existingTitulo = String(existingPage.titulo_bloco ?? '').trim();
      const existingSubtitulo = String(existingPage.subtitulo ?? '').trim();

      const finalTitulo = String(topic?.titulo ?? existingTitulo).trim();
      const finalSubtitulo = String(topic?.subtitulo ?? existingSubtitulo).trim();

      const reorganizedPage: Record<string, unknown> = {
        tipo: 'conteudo',
        bloco_principal: chunk,
        content_blocks: contentBlocks.length > 0 ? contentBlocks : undefined,
        itens: source?.itens?.length ? source.itens : [],
        destaques: source?.destaques?.length ? source.destaques : [],
        citacao: source?.citacao || '',
        sugestao_tabela: source?.sugestao_tabela,
        ...vMeta,
        ...designFields,
      };

      // Só inclui título/subtítulo quando houver valor real.
      if (finalTitulo) reorganizedPage.titulo_bloco = finalTitulo;
      if (finalSubtitulo) reorganizedPage.subtitulo = finalSubtitulo;

      // Preservar capitulo_seq
      if (existingPage.capitulo_seq !== undefined) {
        reorganizedPage.capitulo_seq = existingPage.capitulo_seq;
      }

      newDesignPaginas[idx] = reorganizedPage;
      if (newConteudoPaginas && idx < newConteudoPaginas.length) {
        newConteudoPaginas[idx] = reorganizedPage;
      }
    }

    // ─── ETAPA 6: Remover páginas extras (consolidadas) ───
    // Remover de trás para frente para não bagunçar os índices
    const removeSet = new Set(indicesToRemove);
    if (removeSet.size > 0) {
      const filteredDesign = newDesignPaginas.filter((_, i) => !removeSet.has(i));
      const filteredConteudo = newConteudoPaginas
        ? newConteudoPaginas.filter((_, i) => !removeSet.has(i))
        : null;

      // Recalcular capitulo_seq
      let seq = 0;
      for (const p of filteredDesign) {
        if (p.tipo === 'conteudo') {
          seq += 1;
          p.capitulo_seq = seq;
        }
      }
      if (filteredConteudo) {
        let seq2 = 0;
        for (const p of filteredConteudo) {
          if (p.tipo === 'conteudo') {
            seq2 += 1;
            p.capitulo_seq = seq2;
          }
        }
      }

      const updatedData = {
        ...existingData,
        design: designData ? { ...designData, paginas: filteredDesign } : undefined,
        conteudo: conteudoData
          ? { ...conteudoData, paginas: filteredConteudo || filteredDesign }
          : undefined,
      };
      return NextResponse.json(updatedData);
    }

    // Sem remoções
    const updatedData = {
      ...existingData,
      design: designData ? { ...designData, paginas: newDesignPaginas } : undefined,
      conteudo: conteudoData
        ? { ...conteudoData, paginas: newConteudoPaginas || newDesignPaginas }
        : undefined,
    };

    return NextResponse.json(updatedData);
  } catch (err) {
    console.error('[regenerate-pages]', err);
    const message = err instanceof Error ? err.message : 'Erro ao reorganizar páginas.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
