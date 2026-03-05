import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseVTT } from '@/lib/vtt-parser';
import { generateContent } from '@/lib/content-agent';
import { generateDesign } from '@/lib/design-agent';
import { COURSE_THEMES, type CourseId } from '@/lib/courseThemes';

export const maxDuration = 300;

type ModoGeracao = 'completo' | 'resumido' | 'mapa_mental';

function isModo(mode: string): mode is ModoGeracao {
  return ['completo', 'resumido', 'mapa_mental'].includes(mode);
}

async function loadTema(cursoId: string): Promise<{ name: string; primary: string; primaryLight: string; primaryDark: string; accent: string; backgroundColor?: string; layoutClass?: string }> {
  const themePath = path.join(process.cwd(), 'themes', `${cursoId}.json`);
  try {
    const raw = await readFile(themePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: (data.name as string) || cursoId,
      primary: (data.primary as string) || '#135bec',
      primaryLight: (data.primaryLight as string) || (data.primary as string) || '#3b82f6',
      primaryDark: (data.primaryDark as string) || (data.primary as string) || '#1e40af',
      accent: (data.accent as string) || (data.primary as string) || '#0ea5e9',
      backgroundColor: (data.backgroundColor as string) || '#F8F7E8',
      layoutClass: data.layoutClass as string | undefined,
    };
  } catch {
    const builtIn = COURSE_THEMES[cursoId as CourseId];
    if (builtIn) {
      return {
        name: builtIn.name,
        primary: builtIn.primary,
        primaryLight: builtIn.primaryLight,
        primaryDark: builtIn.primaryDark,
        accent: builtIn.accent,
        backgroundColor: builtIn.backgroundColor,
        layoutClass: builtIn.layoutClass,
      };
    }
    return {
      name: cursoId,
      primary: '#135bec',
      primaryLight: '#3b82f6',
      primaryDark: '#1e40af',
      accent: '#0ea5e9',
      backgroundColor: '#F8F7E8',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const vttFile = formData.get('vtt') as File | null;
    if (!vttFile || !(vttFile instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo VTT não enviado. Use o campo "vtt".' },
        { status: 400 }
      );
    }

    const cursoId = formData.get('curso_id');
    if (!cursoId || typeof cursoId !== 'string') {
      return NextResponse.json(
        { error: 'curso_id não informado.' },
        { status: 400 }
      );
    }

    const modo = formData.get('modo');
    if (!modo || typeof modo !== 'string' || !isModo(modo)) {
      return NextResponse.json(
        { error: 'modo inválido. Use: completo, resumido ou mapa_mental.' },
        { status: 400 }
      );
    }

    const vttContent = await vttFile.text();
    const transcricao = parseVTT(vttContent);
    if (!transcricao.trim()) {
      return NextResponse.json(
        { error: 'O arquivo VTT não contém texto válido.' },
        { status: 400 }
      );
    }

    const tema = await loadTema(cursoId);
    const nomeCurso = tema.name;

    const conteudo = await generateContent(transcricao, modo, nomeCurso);

    const temaParaDesign = cursoId in COURSE_THEMES
      ? COURSE_THEMES[cursoId as CourseId]
      : {
          id: cursoId as CourseId,
          name: tema.name,
          primary: tema.primary,
          primaryLight: tema.primaryLight,
          primaryDark: tema.primaryDark,
          layoutClass: tema.layoutClass || 'theme-geral',
          accent: tema.accent,
          backgroundColor: tema.backgroundColor,
        };

    const conteudoComDesign = await generateDesign(
      conteudo as Record<string, unknown>,
      temaParaDesign
    );

    return NextResponse.json({
      conteudo,
      design: conteudoComDesign,
      tema,
      curso_id: cursoId,
    });
  } catch (err) {
    console.error('[api/generate]', err);
    const message = err instanceof Error ? err.message : 'Erro ao gerar material.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
