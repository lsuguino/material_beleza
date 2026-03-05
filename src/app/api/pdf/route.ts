import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json(
        { error: 'URL da página de prévia não informada. Envie { "url": "..." } no body.' },
        { status: 400 }
      );
    }

    const buffer = await generatePDF(url);

    return new NextResponse(buffer, {
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
