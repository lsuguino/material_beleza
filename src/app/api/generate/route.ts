import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseVTT } from '@/lib/vtt-parser';
import { detectTipoEntrada } from '@/lib/detect-tipo-entrada';
import { parseTextoOrganizado } from '@/lib/text-organizado-parser';
import { generateContent, generateResumoFromOrganizedText } from '@/lib/content-agent';
import { generateDesign } from '@/lib/design-agent';
import { COURSE_THEMES, type CourseId } from '@/lib/courseThemes';
import { VTSD_COLOR, VTSD_LAYOUT_A4 } from '@/lib/vtsd-design-system';
import { getFriendlyErrorMessage } from '@/lib/anthropic-error';
import { ensureOpenRouterKey, ensureGeminiApiKey } from '@/lib/ensure-env';
import { applyNanoBananaImagesToPaginas, type PaginaComImagem } from '@/lib/gemini-nano-banana-images';
import { isRenderableImageUrl } from '@/lib/image-url';
import { generateThreeStudyQuestions } from '@/lib/study-questions-agent';

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

/** Para VTSD (curso_id=geral), garante intro e sumário de referência após capa. */
function injectVtsdReferencePages(conteudo: Record<string, unknown>): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length === 0) return conteudo;

  const hasIntroRef = paginas.some((p) => p.tipo === 'intro_ref');
  const hasSummaryRef = paginas.some((p) => p.tipo === 'sumario_ref');
  if (hasIntroRef && hasSummaryRef) return conteudo;

  const capaIdx = paginas.findIndex((p) => p.tipo === 'capa');
  if (capaIdx < 0) return conteudo;

  const novas = [...paginas];
  let insertAt = capaIdx + 1;
  if (!hasIntroRef) {
    novas.splice(insertAt, 0, { tipo: 'intro_ref', titulo: 'Introdução' });
    insertAt += 1;
  }
  if (!hasSummaryRef) {
    novas.splice(insertAt, 0, { tipo: 'sumario_ref', titulo: 'Sumário' });
  }
  return { ...conteudo, paginas: novas };
}

function toWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Compacta páginas de conteúdo muito curtas quando não há imagem/diagrama,
 * permitindo continuar o próximo tópico na mesma página para reduzir áreas em branco.
 */
function compactSparseContentPages(conteudo: Record<string, unknown>): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length < 2) return conteudo;

  const canMerge = (p: Record<string, unknown>): boolean => {
    if ((p.tipo as string | undefined) !== 'conteudo') return false;
    const hasVisualHint = Boolean(
      p.content_blocks ||
      p.sugestao_imagem ||
      p.prompt_imagem ||
      p.sugestao_grafico ||
      p.sugestao_fluxograma ||
      p.sugestao_tabela
    );
    return !hasVisualHint;
  };

  const result: Array<Record<string, unknown>> = [];
  for (let i = 0; i < paginas.length; i++) {
    const current = { ...paginas[i] };
    const next = paginas[i + 1];

    if (!next || !canMerge(current) || !canMerge(next)) {
      result.push(current);
      continue;
    }

    const curText = String(current.bloco_principal ?? '');
    const nextText = String(next.bloco_principal ?? '');
    const combinedWords = toWordCount(curText) + toWordCount(nextText);

    // Só compacta quando os dois blocos são curtos e cabem confortavelmente numa página.
    if (combinedWords <= 420) {
      const nextTitle = String(next.titulo_bloco ?? next.titulo ?? '').trim();
      current.bloco_principal = `${curText.trim()}\n\n${nextTitle ? `${nextTitle}\n` : ''}${nextText.trim()}`.trim();
      const curD = Array.isArray(current.destaques) ? (current.destaques as string[]) : [];
      const nextD = Array.isArray(next.destaques) ? (next.destaques as string[]) : [];
      current.destaques = [...curD, ...nextD].slice(0, 8);
      for (const key of [
        'sugestao_imagem',
        'prompt_imagem',
        'sugestao_grafico',
        'sugestao_fluxograma',
        'sugestao_tabela',
      ] as const) {
        const curVal = current[key];
        const empty =
          curVal == null ||
          curVal === '' ||
          (typeof curVal === 'string' && !String(curVal).trim());
        if (empty && next[key] != null && next[key] !== '') current[key] = next[key];
      }
      const curCb = current.content_blocks;
      const nextCb = next.content_blocks;
      if ((!Array.isArray(curCb) || curCb.length === 0) && Array.isArray(nextCb) && nextCb.length > 0) {
        current.content_blocks = nextCb;
      }
      i += 1; // consome página seguinte
    }

    result.push(current);
  }

  return { ...conteudo, paginas: result };
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
  if (!Array.isArray(designPaginas) || !Array.isArray(contentPaginas)) {
    console.warn('[api/generate] mergeDesignIntoContent: design sem paginas alinhadas; mantendo conteudo');
    return conteudo;
  }

  const paginasComDesign = contentPaginas.map((p, i) => {
    const d = designPaginas[i];
    if (!d) return p;
    const designFields: Record<string, unknown> = {};
    for (const key of DESIGN_KEYS) if (d[key] !== undefined) designFields[key] = d[key];
    return { ...p, ...designFields };
  });

  return { ...conteudo, ...design, paginas: paginasComDesign };
}

/** Garante que design e conteúdo tenham a mesma URL quando só um lado foi preenchido na geração. */
function syncRenderableImagesBidirectional(
  designPaginas: PaginaComImagem[],
  conteudoPaginas: PaginaComImagem[]
): void {
  const n = Math.min(designPaginas.length, conteudoPaginas.length);
  for (let i = 0; i < n; i++) {
    const d = designPaginas[i];
    const c = conteudoPaginas[i];
    const du = isRenderableImageUrl(d.imagem_url) ? String(d.imagem_url) : null;
    const cu = isRenderableImageUrl(c.imagem_url) ? String(c.imagem_url) : null;
    if (du && !cu) c.imagem_url = du;
    if (cu && !du) d.imagem_url = cu;
    const db = d.content_blocks;
    const cb = c.content_blocks;
    if (!Array.isArray(db) || !Array.isArray(cb)) continue;
    for (let j = 0; j < Math.min(db.length, cb.length); j++) {
      const di = db[j] as Record<string, unknown> | undefined;
      const ci = cb[j] as Record<string, unknown> | undefined;
      if (!di || !ci) continue;
      const diUrl = di.imagem_url ?? di.imageUrl;
      const ciUrl = ci.imagem_url ?? ci.imageUrl;
      const du2 = isRenderableImageUrl(diUrl) ? String(diUrl) : null;
      const cu2 = isRenderableImageUrl(ciUrl) ? String(ciUrl) : null;
      if (du2 && !cu2) {
        ci.imagem_url = du2;
        ci.imageUrl = du2;
      }
      if (cu2 && !du2) {
        di.imagem_url = cu2;
        di.imageUrl = cu2;
      }
    }
  }
}

/** Aplica design padrão (cores do tema + layout) quando o design-agent falha. */
function applyDefaultDesign(
  conteudo: Record<string, unknown>,
  tema: TemaPayload,
  cursoId: string
): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas)) return conteudo;

  const bg = tema.backgroundColor ?? '#F8F7E8';
  const primary = tema.primary ?? '#1a1a1a';
  const accent = tema.accent ?? primary;
  const isVtsd = cursoId === 'geral' || (tema.name || '').toLowerCase().includes('venda todo santo dia');

  const paginasComDesign = paginas.map((p, i) => {
    const tipo = p.tipo as string | undefined;
    let layoutTipo: string;
    if (isVtsd && tipo === 'conteudo') {
      layoutTipo = VTSD_LAYOUT_A4[i % VTSD_LAYOUT_A4.length];
    } else {
      layoutTipo =
        tipo === 'capa'
          ? 'header_destaque'
          : tipo === 'contracapa'
            ? 'header_destaque'
            : i === 1
              ? 'imagem_top'
              : i % 3 === 0
                ? 'dois_colunas'
                : 'header_destaque';
    }
    const fundoPrincipal = isVtsd ? VTSD_COLOR.fundo_page : bg;
    const fundoDestaque = isVtsd ? VTSD_COLOR.primary_darker : accent;
    const textoPrincipal = isVtsd ? VTSD_COLOR.texto_800 : '#1a1a1a';
    return {
      ...p,
      layout_tipo: layoutTipo,
      cor_fundo_principal: fundoPrincipal,
      cor_fundo_destaque: fundoDestaque,
      cor_texto_principal: textoPrincipal,
      cor_texto_destaque: '#FFFFFF',
      icone_sugerido: 'article',
      proporcao_colunas: '60/40' as const,
      usar_barra_lateral: !isVtsd,
      usar_faixa_decorativa: !isVtsd,
    };
  });

  return { ...conteudo, paginas: paginasComDesign };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = await ensureOpenRouterKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave OPENROUTER_API_KEY não configurada. Adicione no arquivo .env.local na raiz do projeto.' },
        { status: 500 }
      );
    }
    process.env.OPENROUTER_API_KEY = apiKey;

    const formData = await request.formData();

    const inputFile = formData.get('vtt') as File | Blob | null;
    if (!inputFile || (typeof (inputFile as Blob).text !== 'function' && typeof (inputFile as Blob).arrayBuffer !== 'function')) {
      return NextResponse.json(
        { error: 'Arquivo não enviado. Selecione um arquivo de texto ou PDF e tente novamente.' },
        { status: 400 }
      );
    }

    const cursoId = (formData.get('curso_id') as string | null)?.trim() || '';
    if (!cursoId) {
      return NextResponse.json(
        { error: 'Curso não informado. Selecione um curso de destino.' },
        { status: 400 }
      );
    }

    const modo = formData.get('modo') as string | null;
    if (!modo || typeof modo !== 'string' || !isModo(modo)) {
      return NextResponse.json(
        { error: 'Modo inválido. Use: completo ou resumido.' },
        { status: 400 }
      );
    }

    const comPerguntasRaw = formData.get('com_perguntas');
    const comPerguntas =
      comPerguntasRaw === '1' ||
      comPerguntasRaw === 'true' ||
      (typeof comPerguntasRaw === 'string' && comPerguntasRaw.toLowerCase() === 'on');

    const fileNameRaw = (inputFile as File).name || '';
    const fileName = fileNameRaw.toLowerCase();
    const isPdf = fileName.endsWith('.pdf') || (inputFile as Blob).type === 'application/pdf';

    let transcricao: string;
    let isTextoOrganizado: boolean;

    if (isPdf) {
      const buf = await (inputFile as Blob).arrayBuffer();
      const buffer = Buffer.from(buf);
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        transcricao = (result?.text ?? '').trim();
        await parser.destroy();
      } catch (err) {
        console.error('[api/generate] PDF parse error:', err);
        return NextResponse.json(
          { error: 'Não foi possível extrair texto do PDF. Verifique se o arquivo não está corrompido ou protegido.' },
          { status: 400 }
        );
      }
      isTextoOrganizado = detectTipoEntrada(transcricao, fileNameRaw, true) === 'organizado';
    } else {
      let textContent: string;
      if (typeof (inputFile as File).text === 'function') {
        textContent = await (inputFile as File).text();
      } else {
        const buf = await (inputFile as Blob).arrayBuffer();
        textContent = new TextDecoder('utf-8').decode(buf);
      }
      isTextoOrganizado = detectTipoEntrada(textContent, fileNameRaw, false) === 'organizado';
      transcricao = parseVTT(textContent);
    }
    if (!transcricao.trim()) {
      return NextResponse.json(
        { error: 'O arquivo não contém texto válido.' },
        { status: 400 }
      );
    }

    const tema = await loadTema(cursoId);
    const nomeCurso = tema.name;

    // 1. Conteúdo: IA (transcrição) ou parser/IA (texto já organizado)
    let conteudo: Record<string, unknown>;
    try {
      if (isTextoOrganizado) {
        if (modo === 'resumido') {
          conteudo = (await generateResumoFromOrganizedText(transcricao, nomeCurso)) as unknown as Record<string, unknown>;
        } else {
          conteudo = parseTextoOrganizado(transcricao, nomeCurso) as unknown as Record<string, unknown>;
        }
      } else {
        conteudo = (await generateContent(transcricao, modo, nomeCurso)) as unknown as Record<string, unknown>;
      }
    } catch (contentErr) {
      console.error('[api/generate] Erro na geração de conteúdo:', contentErr);
      throw contentErr;
    }
    // Normalizar: garantir "paginas" (a IA pode retornar "pages")
    if (!conteudo.paginas && Array.isArray(conteudo.pages)) {
      conteudo = { ...conteudo, paginas: conteudo.pages };
    }
    const paginas = conteudo.paginas as unknown[] | undefined;
    if (!Array.isArray(paginas) || paginas.length === 0) {
      return NextResponse.json(
        { error: 'O conteúdo gerado não retornou páginas válidas. Tente novamente ou use outro arquivo.' },
        { status: 500 }
      );
    }

    let perguntas: string[] | undefined;
    if (comPerguntas) {
      try {
        const tituloMat = String(conteudo.titulo ?? '').trim() || 'Material';
        const subtituloMat = String(conteudo.subtitulo_curso ?? nomeCurso ?? '').trim();
        perguntas = await generateThreeStudyQuestions({
          titulo: tituloMat,
          subtituloCurso: subtituloMat,
          textoBase: transcricao,
        });
      } catch (pqErr) {
        console.warn('[api/generate] Geração de perguntas de estudo falhou:', pqErr);
      }
    }
    // Resumo de Palestra Master Fluxo: adiciona contra capa ao final
    if (cursoId === 'master-fluxo' && Array.isArray(conteudo.paginas)) {
      conteudo = {
        ...conteudo,
        paginas: [
          ...conteudo.paginas,
          { tipo: 'contracapa', titulo: nomeCurso, subtitulo: 'Master Fluxo' },
        ],
      };
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

    const conteudoComCompactacao = compactSparseContentPages(conteudo as unknown as Record<string, unknown>);
    const conteudoAjustado = cursoId === 'geral'
      ? injectVtsdReferencePages(conteudoComCompactacao)
      : conteudoComCompactacao;

    const conteudoRecord = conteudoAjustado;
    let conteudoComDesign: Record<string, unknown>;

    try {
      const conteudoReduzido = buildContentForDesign(conteudoRecord);
      const designRetorno = await generateDesign(conteudoReduzido, temaParaDesign);
      conteudoComDesign = mergeDesignIntoContent(conteudoRecord, designRetorno);
    } catch (designErr) {
      console.warn('[api/generate] Design-agent falhou, aplicando design padrão:', designErr);
      conteudoComDesign = applyDefaultDesign(conteudoRecord, tema, cursoId);
    }

    // Garantir que design e conteudo tenham "paginas" (normalizar se a IA retornar "pages")
    const normalizePaginas = (obj: Record<string, unknown>): Record<string, unknown> => {
      const paginas = (obj.paginas ?? obj.pages) as unknown[] | undefined;
      if (!Array.isArray(paginas)) return obj;
      return { ...obj, paginas };
    };
    const conteudoNorm = normalizePaginas(conteudoRecord);
    let designNorm = normalizePaginas(conteudoComDesign);

    // 3. Imagens: OpenRouter (OPENROUTER_MODEL_IMAGE) ou Gemini direto (GEMINI_API_KEY)
    const hasOpenRouterImage =
      !!process.env.OPENROUTER_MODEL_IMAGE?.trim() && !!process.env.OPENROUTER_API_KEY?.trim();
    const geminiKeyForImages = await ensureGeminiApiKey();
    if (geminiKeyForImages) process.env.GEMINI_API_KEY = geminiKeyForImages;
    if (hasOpenRouterImage || geminiKeyForImages) {
      try {
        const designPaginas = designNorm.paginas as PaginaComImagem[] | undefined;
        const conteudoPaginas = conteudoNorm.paginas as PaginaComImagem[] | undefined;
        if (Array.isArray(designPaginas) && designPaginas.length > 0) {
          const imagePromptCache = new Map<string, string>();
          await applyNanoBananaImagesToPaginas(designPaginas, imagePromptCache);
          if (Array.isArray(conteudoPaginas) && conteudoPaginas.length > 0) {
            await applyNanoBananaImagesToPaginas(conteudoPaginas, imagePromptCache);
            syncRenderableImagesBidirectional(designPaginas, conteudoPaginas);
          }
          designNorm = { ...designNorm, paginas: designPaginas as unknown[] };
        }
      } catch (imgErr) {
        console.warn('[api/generate] Etapa de imagens falhou:', imgErr);
      }
    }

    return NextResponse.json({
      conteudo: { ...conteudoNorm, paginas: conteudoNorm.paginas ?? [] },
      design: { ...designNorm, paginas: designNorm.paginas ?? conteudoNorm.paginas ?? [] },
      tema,
      curso_id: cursoId,
      ...(perguntas && perguntas.length > 0 ? { perguntas } : {}),
    });
  } catch (err) {
    console.error('[api/generate]', err);
    let message: string;
    try {
      message = getFriendlyErrorMessage(err);
    } catch {
      message = err instanceof Error ? err.message : 'Erro ao gerar material. Tente novamente.';
    }
    if (!message || message.length > 500) message = 'Erro ao gerar material. Tente novamente.';
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status: number }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 500 });
  }
}
