import { NextRequest, NextResponse } from 'next/server';
import { parseVtt } from '@/lib/vtt';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    const text = await file.text();
    const { text: transcript, cues } = parseVtt(text);
    return NextResponse.json({
      transcript,
      cues,
      cueCount: cues.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Erro ao processar o arquivo VTT.' },
      { status: 500 }
    );
  }
}
