import { NextRequest, NextResponse } from 'next/server';
import { applyNanoBananaImagesToPaginas, type PaginaComImagem } from '@/lib/gemini-nano-banana-images';
import { extractPageText } from '@/lib/content-agent';

export const maxDuration = 60;

interface PageImageRequest {
  existingData: {
    conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    design?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    tema?: Record<string, unknown>;
    curso_id?: string;
    perguntas?: string[];
  };
  pageIndex: number;
  action: 'generate' | 'regenerate';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PageImageRequest;
    const { existingData, pageIndex, action } = body;

    if (!existingData || typeof pageIndex !== 'number') {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    const designData = existingData.design || existingData.conteudo;
    const conteudoData = existingData.conteudo;
    if (!designData?.paginas || !Array.isArray(designData.paginas)) {
      return NextResponse.json({ error: 'Dados do material inválidos.' }, { status: 400 });
    }

    if (pageIndex < 0 || pageIndex >= designData.paginas.length) {
      return NextResponse.json({ error: 'Índice de página inválido.' }, { status: 400 });
    }

    const page = { ...designData.paginas[pageIndex] };

    if (action === 'generate') {
      // Criar prompt baseado no conteúdo da página
      const titulo = String(page.titulo_bloco ?? page.titulo ?? '');
      const texto = extractPageText(page);
      const resumo = texto.slice(0, 200);
      page.sugestao_imagem =
        `Fotografia profissional relacionada ao tema: ${titulo}. ${resumo}`.slice(0, 500);
      // Limpar imagem existente para forçar nova geração
      delete page.imagem_url;
    } else {
      // Regenerate: limpar a imagem atual para forçar nova geração com mesmo prompt
      delete page.imagem_url;
      // Se não tem sugestao_imagem, criar um
      if (!page.sugestao_imagem) {
        const titulo = String(page.titulo_bloco ?? page.titulo ?? '');
        page.sugestao_imagem = `Fotografia profissional sobre: ${titulo}`;
      }
    }

    // Gerar imagem
    const paginaArr: PaginaComImagem[] = [page as PaginaComImagem];
    await applyNanoBananaImagesToPaginas(paginaArr);

    const updatedPage = paginaArr[0] as Record<string, unknown>;

    if (!updatedPage.imagem_url) {
      return NextResponse.json({ error: 'Não foi possível gerar a imagem.' }, { status: 500 });
    }

    // Build updated PreviewData
    const newDesignPaginas = [...designData.paginas];
    newDesignPaginas[pageIndex] = { ...designData.paginas[pageIndex], ...updatedPage };

    const newConteudoPaginas = conteudoData?.paginas ? [...conteudoData.paginas] : null;
    if (newConteudoPaginas && pageIndex < newConteudoPaginas.length) {
      newConteudoPaginas[pageIndex] = { ...newConteudoPaginas[pageIndex], ...updatedPage };
    }

    const updatedData = {
      ...existingData,
      design: designData ? { ...designData, paginas: newDesignPaginas } : undefined,
      conteudo: conteudoData
        ? { ...conteudoData, paginas: newConteudoPaginas || newDesignPaginas }
        : undefined,
    };

    return NextResponse.json(updatedData);
  } catch (err) {
    console.error('[page-image]', err);
    const message = err instanceof Error ? err.message : 'Erro ao gerar imagem.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
