import { NextRequest, NextResponse } from 'next/server';
import { pdfGet, pdfDelete } from '@/lib/pdf-store';

export const maxDuration = 90;

/**
 * GET /api/pdf/[id]          → aguarda o PDF ficar pronto e o serve
 * GET /api/pdf/[id]?check=1  → retorna status sem bloquear (para polling do cliente)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isCheck = new URL(req.url).searchParams.get('check') === '1';

  const entry = pdfGet(id);
  if (!entry) {
    return NextResponse.json({ error: 'PDF não encontrado ou expirado.' }, { status: 404 });
  }

  // Status check — responde imediatamente sem bloquear
  if (isCheck) {
    return NextResponse.json({ ready: entry.ready, error: entry.error ?? undefined });
  }

  // Long-poll: aguarda até 75 s pelo PDF
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const e = pdfGet(id);
    if (!e) return NextResponse.json({ error: 'PDF não encontrado.' }, { status: 404 });

    if (e.ready) {
      if (e.error) return NextResponse.json({ error: e.error }, { status: 500 });
      if (e.buffer) {
        const buf = e.buffer;
        pdfDelete(id);
        return new NextResponse(buf as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="material.pdf"',
            'Content-Length': String(buf.length),
          },
        });
      }
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return NextResponse.json({ error: 'Timeout ao aguardar o PDF. Tente baixar novamente.' }, { status: 408 });
}
