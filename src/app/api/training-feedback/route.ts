import { NextRequest, NextResponse } from 'next/server';
import type { PreviewData } from '@/components/MaterialPreviewBlocks';
import { appendTrainingFeedback, getTrainingStats, type TrainingVerdict } from '@/lib/training-feedback-store';
import { stripPreviewDataForTraining, stripTeachingMaterialForTraining } from '@/lib/training-feedback-sanitize';

export const runtime = 'nodejs';

const MAX_BODY_CHARS = 6_000_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    const stats = await getTrainingStats();
    return NextResponse.json(stats);
  } catch (e) {
    console.error('[training-feedback GET]', e);
    return NextResponse.json({ error: 'Não foi possível ler o histórico de treino.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return badRequest('Payload muito grande. Remova imagens extras ou tente novamente.');
    }
    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return badRequest('JSON inválido.');
    }
    const o = body as Record<string, unknown>;
    const verdict = o.verdict as TrainingVerdict | undefined;
    if (verdict !== 'approve' && verdict !== 'reject') {
      return badRequest('Informe verdict: "approve" ou "reject".');
    }

    const format = (o.format as string) === 'teaching' ? 'teaching' : 'scribo';
    const note = typeof o.note === 'string' ? o.note.slice(0, 4_000) : undefined;

    const metaRaw = o.meta;
    const meta =
      metaRaw && typeof metaRaw === 'object'
        ? Object.fromEntries(
            Object.entries(metaRaw as Record<string, unknown>).map(([k, v]) => [k, v === undefined ? undefined : String(v)])
          )
        : undefined;

    if (format === 'scribo') {
      const snapshot = o.snapshot;
      if (!snapshot || typeof snapshot !== 'object') {
        return badRequest('Envie snapshot com o material atual (PreviewData).');
      }
      const cleaned = stripPreviewDataForTraining(snapshot as PreviewData);
      const record = await appendTrainingFeedback({
        verdict,
        format: 'scribo',
        previewData: cleaned,
        note,
        meta,
      });
      return NextResponse.json({ ok: true, id: record.id, createdAt: record.createdAt });
    }

    const teaching = o.teachingMaterial;
    if (!teaching || typeof teaching !== 'object') {
      return badRequest('Envie teachingMaterial (objeto da apostila) para format=teaching.');
    }
    const cleaned = stripTeachingMaterialForTraining(teaching as Record<string, unknown>);
    const record = await appendTrainingFeedback({
      verdict,
      format: 'teaching',
      teachingMaterial: cleaned,
      note,
      meta,
    });
    return NextResponse.json({ ok: true, id: record.id, createdAt: record.createdAt });
  } catch (e) {
    console.error('[training-feedback POST]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao registrar feedback.' }, { status: 500 });
  }
}
