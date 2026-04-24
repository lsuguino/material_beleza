import { NextRequest, NextResponse } from 'next/server';
import { applyNanoBananaImagesToPaginas } from '@/lib/gemini-nano-banana-images';

export const maxDuration = 120;

type PaginaLike = {
  imagem_url?: unknown;
  imageUrl?: unknown;
  content_blocks?: unknown;
  [key: string]: unknown;
};

/**
 * Limpa URLs de imagem existentes pra forçar uma regeração fresca.
 * Sem isso, o cap de MAX_IMAGES_PER_MATERIAL não deixaria gerar novas.
 */
function clearExistingImages(paginas: PaginaLike[]): void {
  for (const p of paginas) {
    delete p.imagem_url;
    delete p.imageUrl;
    const blocks = p.content_blocks;
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        if (!b || typeof b !== 'object') continue;
        const bo = b as Record<string, unknown>;
        delete bo.imagem_url;
        delete bo.imageUrl;
      }
    }
  }
}

/**
 * POST /api/regenerate-images
 * Body: { previewData: { conteudo, design, ... } }
 *
 * Regenera somente as imagens do material (limpa as existentes e roda
 * applyNanoBananaImagesToPaginas). Mantém texto, design e layout intactos.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const previewData = body?.previewData;
    if (!previewData || typeof previewData !== 'object') {
      return NextResponse.json(
        { error: 'previewData ausente ou inválido.' },
        { status: 400 },
      );
    }

    const data = previewData as Record<string, unknown>;
    const conteudo = (data.conteudo as Record<string, unknown> | undefined) ?? data;
    const design = (data.design as Record<string, unknown> | undefined) ?? conteudo;

    const paginasConteudo = conteudo?.paginas as PaginaLike[] | undefined;
    const paginasDesign = design?.paginas as PaginaLike[] | undefined;

    const cache = new Map<string, string>();

    if (Array.isArray(paginasConteudo)) {
      clearExistingImages(paginasConteudo);
      await applyNanoBananaImagesToPaginas(paginasConteudo, cache);
    }
    if (Array.isArray(paginasDesign) && paginasDesign !== paginasConteudo) {
      clearExistingImages(paginasDesign);
      await applyNanoBananaImagesToPaginas(paginasDesign, cache);
    }

    return NextResponse.json({ previewData: data });
  } catch (err) {
    console.error('[regenerate-images]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao regerar imagens.' },
      { status: 500 },
    );
  }
}
