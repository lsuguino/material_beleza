import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseVTT } from '@/lib/vtt-parser';
import { generateContent } from '@/lib/content-agent';
import { generateDesign } from '@/lib/design-agent';
import { COURSE_THEMES, type CourseId } from '@/lib/courseThemes';

export const maxDuration = 300;

type ModoGeracao = 'completo' | 'resumido';

function isModo(mode: string): mode is ModoGeracao {
  return ['completo', 'resumido'].includes(mode);
}

type TemaPayload = { name: string; primary: string; primaryLight: string; primaryDark: string; accent: string; backgroundColor?: string; layoutClass?: string };

const themeCache = new Map<string, TemaPayload>();

async function loadTema(cursoId: string): Promise<TemaPayload> {
  const cached = themeCache.get(cursoId);
  if (cached) return cached;

  const builtIn = COURSE_THEMES[cursoId as CourseId];
  if (builtIn) {
    const tema: TemaPayload = {
      name: builtIn.name,
      primary: builtIn.primary,
      primaryLight: builtIn.primaryLight,
      primaryDark: builtIn.primaryDark,
      accent: builtIn.accent,
      backgroundColor: builtIn.backgroundColor,
      layoutClass: builtIn.layoutClass,
    };
    themeCache.set(cursoId, tema);
    return tema;
  }

  const themePath = path.join(process.cwd(), 'themes', `${cursoId}.json`);
  try {
    const raw = await readFile(themePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const tema: TemaPayload = {
      name: (data.name as string) || cursoId,
      primary: (data.primary as string) || '#135bec',
      primaryLight: (data.primaryLight as string) || (data.primary as string) || '#3b82f6',
      primaryDark: (data.primaryDark as string) || (data.primary as string) || '#1e40af',
      accent: (data.accent as string) || (data.primary as string) || '#0ea5e9',
      backgroundColor: (data.backgroundColor as string) || '#F8F7E8',
      layoutClass: data.layoutClass as string | undefined,
    };
    themeCache.set(cursoId, tema);
    return tema;
  } catch {
    const tema: TemaPayload = {
      name: cursoId,
      primary: '#135bec',
      primaryLight: '#3b82f6',
      primaryDark: '#1e40af',
      accent: '#0ea5e9',
      backgroundColor: '#F8F7E8',
    };
    themeCache.set(cursoId, tema);
    return tema;
  }
}

/** Reduz o conteúdo para o design-agent (só estrutura + trechos curtos) para menos tokens e resposta mais rápida */
function buildContentForDesign(conteudo: Record<string, unknown>): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas)) return conteudo;

  const paginasReduzidas = paginas.map((p) => {
    const bloco = p.bloco_principal as string | undefined;
    const blocoCurto = typeof bloco === 'string' ? bloco.slice(0, 120).trim() + (bloco.length > 120 ? '...' : '') : '';
    return {
      tipo: p.tipo,
      titulo: p.titulo,
      subtitulo: p.subtitulo,
      titulo_bloco: p.titulo_bloco,
      bloco_principal: blocoCurto,
      content_blocks: p.content_blocks,
      destaques: p.destaques,
      citacao: p.citacao,
      dado_numerico: p.dado_numerico,
      sugestao_imagem: p.sugestao_imagem,
      prompt_imagem: p.prompt_imagem,
      sugestao_icone: p.sugestao_icone,
      sugestao_grafico: p.sugestao_grafico,
      sugestao_fluxograma: p.sugestao_fluxograma,
      sugestao_tabela: p.sugestao_tabela,
    };
  });

  return {
    titulo: conteudo.titulo,
    subtitulo_curso: conteudo.subtitulo_curso,
    paginas: paginasReduzidas,
  };
}

const DESIGN_KEYS = [
  'layout_tipo', 'cor_fundo_principal', 'cor_fundo_destaque', 'cor_texto_principal', 'cor_texto_destaque',
  'icone_sugerido', 'proporcao_colunas', 'usar_barra_lateral', 'usar_faixa_decorativa',
] as const;

/** Mescla apenas os campos de design no conteúdo completo (preserva texto completo das páginas). */
function mergeDesignIntoContent(
  conteudo: Record<string, unknown>,
  design: Record<string, unknown>
): Record<string, unknown> {
  const designPaginas = design.paginas as Array<Record<string, unknown>> | undefined;
  const contentPaginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(designPaginas) || !Array.isArray(contentPaginas)) return design;

  const paginasComDesign = contentPaginas.map((p, i) => {
    const d = designPaginas[i];
    if (!d) return p;
    const designFields: Record<string, unknown> = {};
    for (const key of DESIGN_KEYS) if (d[key] !== undefined) designFields[key] = d[key];
    return { ...p, ...designFields };
  });

  return { ...conteudo, ...design, paginas: paginasComDesign };
}

/** Aplica design padrão (cores do tema + layout) quando o design-agent falha. */
function applyDefaultDesign(
  conteudo: Record<string, unknown>,
  tema: TemaPayload
): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas)) return conteudo;

  const bg = tema.backgroundColor ?? '#F8F7E8';
  const primary = tema.primary ?? '#1a1a1a';
  const accent = tema.accent ?? primary;

  const paginasComDesign = paginas.map((p, i) => {
    const tipo = p.tipo as string | undefined;
    const layoutTipo =
      tipo === 'capa'
        ? 'header_destaque'
        : i === 1
          ? 'imagem_top'
          : i % 3 === 0
            ? 'dois_colunas'
            : 'header_destaque';
    return {
      ...p,
      layout_tipo: layoutTipo,
      cor_fundo_principal: bg,
      cor_fundo_destaque: accent,
      cor_texto_principal: '#1a1a1a',
      cor_texto_destaque: '#FFFFFF',
      icone_sugerido: 'article',
      proporcao_colunas: '60/40' as const,
      usar_barra_lateral: true,
      usar_faixa_decorativa: true,
    };
  });

  return { ...conteudo, paginas: paginasComDesign };
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
        { error: 'modo inválido. Use: completo ou resumido.' },
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

    // 1. Gera o material escrito; o content-agent faz a CONFERÊNCIA (verifica se todo o VTT está no material) antes de retornar.
    let conteudo = (await generateContent(transcricao, modo, nomeCurso)) as unknown as Record<string, unknown>;
    // Normalizar: garantir "paginas" (a IA pode retornar "pages")
    if (!conteudo.paginas && Array.isArray(conteudo.pages)) {
      conteudo = { ...conteudo, paginas: conteudo.pages };
    }

    // 2. Só após o conteúdo conferido, gera o design (com payload reduzido para resposta mais rápida).
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

    const conteudoRecord = conteudo as unknown as Record<string, unknown>;
    let conteudoComDesign: Record<string, unknown>;

    try {
      const conteudoReduzido = buildContentForDesign(conteudoRecord);
      const designRetorno = await generateDesign(conteudoReduzido, temaParaDesign);
      conteudoComDesign = mergeDesignIntoContent(conteudoRecord, designRetorno);
    } catch (designErr) {
      console.warn('[api/generate] Design-agent falhou, aplicando design padrão:', designErr);
      conteudoComDesign = applyDefaultDesign(conteudoRecord, tema);
    }

    // Garantir que design e conteudo tenham "paginas" (normalizar se a IA retornar "pages")
    const normalizePaginas = (obj: Record<string, unknown>): Record<string, unknown> => {
      const paginas = (obj.paginas ?? obj.pages) as unknown[] | undefined;
      if (!Array.isArray(paginas)) return obj;
      return { ...obj, paginas };
    };
    const conteudoNorm = normalizePaginas(conteudoRecord);
    const designNorm = normalizePaginas(conteudoComDesign);

    return NextResponse.json({
      conteudo: { ...conteudoNorm, paginas: conteudoNorm.paginas ?? [] },
      design: { ...designNorm, paginas: designNorm.paginas ?? conteudoNorm.paginas ?? [] },
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
