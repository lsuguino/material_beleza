import { NextRequest, NextResponse } from 'next/server';
import { peekPreviewJsonForPdf } from '@/lib/pdf-preview-session';

/**
 * GET /api/pdf-preview-session/[id]
 * Retorna o JSON do preview armazenado no servidor.
 * Usado pela página /preview?session=ID para carregar dados sem localStorage.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[pdf-preview-session] Fetching session:', id);
  const json = peekPreviewJsonForPdf(id);
  if (!json) {
    console.warn('[pdf-preview-session] Session NOT found:', id);
    return NextResponse.json(
      { error: 'Sessão não encontrada ou expirada.' },
      { status: 404 }
    );
  }
  console.log('[pdf-preview-session] Session found, size:', json.length, 'bytes');
  return new NextResponse(json, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
