import { NextRequest, NextResponse } from 'next/server';
import { reorganizePageRich, type ModoContent } from '@/lib/content-agent';
import { TRANSCRIPTION_MAX_CHARS } from '@/lib/api-payload-limits';
import { ensureOpenRouterKey } from '@/lib/ensure-env';
import { generateMaterialImage } from '@/lib/gemini-nano-banana-images';
import { openRouterGenerateImage } from '@/lib/openrouter';
import {
  getAspectRatioForLayout,
  MAX_IMAGES_PER_MATERIAL,
} from '@/lib/image-prompt';
import { isRenderableImageUrl } from '@/lib/image-url';

export const maxDuration = 180;

interface RegenerateRequest {
  existingData: {
    conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    design?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    tema?: Record<string, unknown>;
    curso_id?: string;
    perguntas?: string[];
  };
  pageIndices: number[];
  curso_id: string;
  modo?: string;
  transcription?: string;
}

const NON_CONTENT_TYPES = new Set([
  'capa',
  'contracapa',
  'sumario_ref',
  'sumario',
  'intro_ref',
  'conclusao_ref',
  'atividades_finais',
]);

function isContentPage(page: Record<string, unknown>): boolean {
  const tipo = (page.tipo as string) || 'conteudo';
  return !NON_CONTENT_TYPES.has(tipo);
}

/** Conta imagens já presentes no material (em qualquer página). */
function countExistingImages(paginas: Array<Record<string, unknown>>): number {
  let count = 0;
  for (const p of paginas) {
    if (isRenderableImageUrl(p.imagem_url)) count += 1;
    const blocks = p.content_blocks;
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        if (b && typeof b === 'object') {
          const bo = b as Record<string, unknown>;
          if (isRenderableImageUrl(bo.imagem_url) || isRenderableImageUrl(bo.imageUrl)) {
            count += 1;
          }
        }
      }
    }
  }
  return count;
}

async function tryGenerateImageForPage(
  prompt: string,
  layoutTipo: string,
  pageTipo: string,
): Promise<string | null> {
  const ratio = getAspectRatioForLayout(layoutTipo, pageTipo);
  try {
    const url = await openRouterGenerateImage(prompt, ratio);
    if (url) return url;
  } catch (e) {
    console.warn('[regenerate-pages] OpenRouter image falhou:', e);
  }
  try {
    return await generateMaterialImage(prompt, ratio);
  } catch (e) {
    console.warn('[regenerate-pages] Gemini direto image falhou:', e);
    return null;
  }
}

/**
 * POST /api/regenerate-pages
 *
 * Reorganiza CADA página selecionada individualmente — enriquece, sugere
 * visual estruturado, sugere imagem (respeitando cap de 2/material),
 * sugere novo layout. NUNCA consolida ou remove páginas.
 */
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
    if (!transcription || transcription.length < 50) {
      return NextResponse.json(
        { error: 'Transcrição original necessária pra reorganizar (não foi enviada).' },
        { status: 400 },
      );
    }

    const designData = existingData.design || existingData.conteudo;
    const conteudoData = existingData.conteudo;
    if (!designData?.paginas || !Array.isArray(designData.paginas)) {
      return NextResponse.json({ error: 'Dados do material inválidos.' }, { status: 400 });
    }

    await ensureOpenRouterKey();

    const cursoId = curso_id || existingData.curso_id || 'geral';
    const modoContent: ModoContent = modo === 'resumido' ? 'resumido' : 'completo';

    const designPaginas = [...designData.paginas];
    const conteudoPaginas = conteudoData?.paginas ? [...conteudoData.paginas] : null;

    // Filtra: só páginas válidas de conteúdo
    const validIndices = pageIndices
      .filter((i) => i >= 0 && i < designPaginas.length && isContentPage(designPaginas[i]))
      .sort((a, b) => a - b);

    if (validIndices.length === 0) {
      return NextResponse.json({ error: 'Nenhuma página válida para reorganizar.' }, { status: 400 });
    }

    let imagesUsed = countExistingImages(designPaginas);

    // Processa páginas em sequência — evita rate limit + permite gerenciar cap de imagem
    for (const idx of validIndices) {
      const page = designPaginas[idx];
      console.log(
        `[regenerate-pages] reorganizando página ${idx} "${(page.titulo_bloco as string) || ''}"`,
      );
      const result = await reorganizePageRich(page, transcription, modoContent);

      // Aplica enrichment textual
      const newPage: Record<string, unknown> = {
        ...page,
        bloco_principal: result.bloco_principal,
        itens: result.itens,
        destaques: result.destaques,
        citacao: result.citacao || (page.citacao as string | undefined),
      };
      if (result.sugestao_tabela) newPage.sugestao_tabela = result.sugestao_tabela;

      // Visual estruturado: substitui content_blocks por [text, visual]
      if (result.content_block_visual) {
        const textBlock = { type: 'text' as const, content: result.bloco_principal };
        newPage.content_blocks = [textBlock, result.content_block_visual];
      }

      // Layout sugerido (regra 2A: aplica)
      if (result.layout_tipo_sugerido && result.layout_tipo_sugerido !== page.layout_tipo) {
        newPage.layout_tipo = result.layout_tipo_sugerido;
        console.log(
          `[regenerate-pages] página ${idx}: layout ${page.layout_tipo} → ${result.layout_tipo_sugerido}`,
        );
      }

      // Imagem sugerida + cap rígido (regra 1A: ignora se cap atingido)
      if (
        result.sugestao_imagem &&
        result.sugestao_imagem.length >= 6 &&
        !isRenderableImageUrl(newPage.imagem_url)
      ) {
        if (imagesUsed >= MAX_IMAGES_PER_MATERIAL) {
          console.log(
            `[regenerate-pages] página ${idx}: sugestao_imagem ignorada — cap de ${MAX_IMAGES_PER_MATERIAL} já atingido`,
          );
          newPage.sugestao_imagem = result.sugestao_imagem;
        } else {
          const imgLayout = String(newPage.layout_tipo ?? page.layout_tipo ?? '');
          const imgTipo = String(newPage.tipo ?? page.tipo ?? 'conteudo');
          const url = await tryGenerateImageForPage(
            result.sugestao_imagem,
            imgLayout,
            imgTipo,
          );
          if (url) {
            newPage.imagem_url = url;
            newPage.sugestao_imagem = result.sugestao_imagem;
            imagesUsed += 1;
            console.log(`[regenerate-pages] página ${idx}: imagem gerada (${imagesUsed}/${MAX_IMAGES_PER_MATERIAL})`);
          } else {
            console.warn(`[regenerate-pages] página ${idx}: geração de imagem falhou`);
          }
        }
      }

      designPaginas[idx] = newPage;
      if (conteudoPaginas && idx < conteudoPaginas.length) {
        conteudoPaginas[idx] = newPage;
      }
    }

    const updatedData = {
      ...existingData,
      design: designData ? { ...designData, paginas: designPaginas } : undefined,
      conteudo: conteudoData
        ? { ...conteudoData, paginas: conteudoPaginas || designPaginas }
        : undefined,
    };

    return NextResponse.json(updatedData);
  } catch (err) {
    console.error('[regenerate-pages]', err);
    const message = err instanceof Error ? err.message : 'Erro ao reorganizar páginas.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
