import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';
import { takePreviewJsonForPdf } from '@/lib/pdf-preview-session';
import { PREVIEW_STORAGE_KEY } from '@/lib/preview-storage';

export const maxDuration = 120;

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

    const previewSessionId =
      typeof body.previewSessionId === 'string' ? body.previewSessionId.trim() : '';

    let localStorageData: Record<string, string> | undefined;

    if (previewSessionId) {
      const json = takePreviewJsonForPdf(previewSessionId);
      if (!json) {
        return NextResponse.json(
          {
            error:
              'Sessão de preview expirou ou já foi usada. Abra o preview novamente e tente baixar o PDF.',
          },
          { status: 400 }
        );
      }
      localStorageData = {
        [PREVIEW_STORAGE_KEY]: json,
        'rtg-pdf-mode': '1',
      };
    } else if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      localStorageData = body.data as Record<string, string>;
    }

    const buffer = await generatePDF(url, localStorageData);

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
