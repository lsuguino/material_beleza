import { NextRequest, NextResponse } from 'next/server';
import { applyPageInstruction, type ModoContent } from '@/lib/content-agent';
import { ensureOpenRouterKey } from '@/lib/ensure-env';

export const maxDuration = 60;

interface EditPageRequest {
  existingData: {
    conteudo?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    design?: { titulo?: string; subtitulo_curso?: string; paginas?: Array<Record<string, unknown>> };
    tema?: Record<string, unknown>;
    curso_id?: string;
    perguntas?: string[]; 
  };
  pageIndex: number;
  instruction: string;
  modo?: string;
  transcription?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = await ensureOpenRouterKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Chave OpenRouter não configurada no servidor. Na Vercel, adicione OPENROUTER_API_KEY ou OPENROUTER nas Environment Variables do projeto e faça um novo deploy.',
        },
        { status: 503 },
      );
    }

    const body = (await req.json()) as EditPageRequest;
    const { existingData, pageIndex, instruction, modo, transcription } = body;

    if (!existingData || typeof pageIndex !== 'number' || !instruction?.trim()) {
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

    const modoContent: ModoContent = modo === 'resumido' ? 'resumido' : 'completo';
    const existingPage = designData.paginas[pageIndex];

    const updatedPage = await applyPageInstruction(
      existingPage,
      instruction.trim(),
      transcription,
      modoContent,
    );

    // Build updated PreviewData
    const newDesignPaginas = [...designData.paginas];
    newDesignPaginas[pageIndex] = updatedPage;

    const newConteudoPaginas = conteudoData?.paginas ? [...conteudoData.paginas] : null;
    if (newConteudoPaginas && pageIndex < newConteudoPaginas.length) {
      newConteudoPaginas[pageIndex] = updatedPage;
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
    console.error('[edit-page]', err);
    const message = err instanceof Error ? err.message : 'Erro ao editar página.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
