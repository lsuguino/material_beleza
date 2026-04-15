import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';
import { stashPreviewJsonForPdf } from '@/lib/pdf-preview-session';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Aceita dados inline ou session ID
    let sessionId: string;

    if (typeof body.sessionId === 'string' && body.sessionId.trim()) {
      // Session já existe (criada pelo cliente)
      sessionId = body.sessionId.trim();
    } else if (body.data && typeof body.data === 'object') {
      // Dados enviados inline — armazena no servidor e gera session
      const json = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);
      sessionId = stashPreviewJsonForPdf(json);
    } else {
      return NextResponse.json(
        { error: 'Envie { "data": {...} } ou { "sessionId": "..." } no body.' },
        { status: 400 }
      );
    }

    // Monta URL do preview com session ID (sem depender de localStorage)
    const origin = request.nextUrl.origin;
    const previewUrl = `${origin}/preview?session=${sessionId}`;
    console.log('[api/pdf] Session created:', sessionId, '| Preview URL:', previewUrl);

    // Puppeteer abre o preview — os dados vêm via fetch do servidor, sem localStorage
    const buffer = await generatePDF(previewUrl);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="material.pdf"',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[api/pdf]', err);
    const message = err instanceof Error ? err.message : 'Erro ao gerar PDF.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
