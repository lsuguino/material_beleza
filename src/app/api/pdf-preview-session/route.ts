import { NextRequest, NextResponse } from 'next/server';
import { stashPreviewJsonForPdf } from '@/lib/pdf-preview-session';

export const maxDuration = 120;

/**
 * Recebe o JSON completo do preview (com imagens) e devolve um id de sessão
 * para POST /api/pdf usar sem enviar megabytes no corpo repetidamente.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload =
      typeof body.payload === 'string'
        ? body.payload
        : body.data !== undefined
          ? JSON.stringify(body.data)
          : null;
    if (!payload || payload.length < 2) {
      return NextResponse.json({ error: 'payload ausente ou inválido.' }, { status: 400 });
    }
    const id = stashPreviewJsonForPdf(payload);
    return NextResponse.json({ id });
  } catch (err) {
    console.error('[pdf-preview-session]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao guardar preview para PDF.' },
      { status: 500 }
    );
  }
}
