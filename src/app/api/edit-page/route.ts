import { NextRequest, NextResponse } from 'next/server';
import { applyPageInstruction, type ModoContent } from '@/lib/content-agent';
import { TRANSCRIPTION_MAX_CHARS } from '@/lib/api-payload-limits';
import { ensureOpenRouterKey } from '@/lib/ensure-env';

export const maxDuration = 60;

/** Payload enxuto: só a página editada (evita 413 na Vercel pelo material inteiro). */
interface EditPageRequestLite {
  existingPage: Record<string, unknown>;
  pageIndex: number;
  instruction: string;
  modo?: string;
  transcription?: string;
}

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

function withOptionalTitles(
  updatedPage: Record<string, unknown>,
  existingPage: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...updatedPage };

  const normalizeField = (field: 'titulo_bloco' | 'subtitulo' | 'titulo') => {
    const updated = String(updatedPage[field] ?? '').trim();
    const existing = String(existingPage[field] ?? '').trim();
    const finalValue = updated || existing;
    if (finalValue) out[field] = finalValue;
    else delete out[field];
  };

  normalizeField('titulo_bloco');
  normalizeField('subtitulo');
  normalizeField('titulo');

  return out;
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

    const body = (await req.json()) as EditPageRequest & Partial<EditPageRequestLite>;
    const transcriptionRaw = body.transcription;
    const transcription =
      typeof transcriptionRaw === 'string'
        ? transcriptionRaw.slice(0, TRANSCRIPTION_MAX_CHARS)
        : undefined;

    // Modo enxuto (recomendado no deploy): uma página só — não envia todo o material.
    if (body.existingPage != null && typeof body.pageIndex === 'number') {
      const { existingPage, pageIndex, instruction, modo } = body as EditPageRequestLite;
      if (!instruction?.trim()) {
        return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
      }
      const modoContent: ModoContent = modo === 'resumido' ? 'resumido' : 'completo';
      const updatedPageRaw = await applyPageInstruction(
        existingPage,
        instruction.trim(),
        transcription,
        modoContent,
      );
      const updatedPage = withOptionalTitles(updatedPageRaw, existingPage);
      return NextResponse.json({ updatedPage, pageIndex });
    }

    const { existingData, pageIndex, instruction, modo } = body as EditPageRequest;

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

    const updatedPageRaw = await applyPageInstruction(
      existingPage,
      instruction.trim(),
      transcription,
      modoContent,
    );
    const updatedPage = withOptionalTitles(updatedPageRaw, existingPage);

    // Build updated PreviewData (payload completo — legado)
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
