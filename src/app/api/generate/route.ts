import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseVTT } from '@/lib/vtt-parser';
import { detectTipoEntrada } from '@/lib/detect-tipo-entrada';
import { generateContent, generateResumoFromOrganizedText } from '@/lib/content-agent';
import { sanitizeConteudoLayouts, VTSD_ALTERNATION_POOL } from '@/lib/allowed-layouts';
import { generateDesign } from '@/lib/design-agent';
import { COURSE_THEMES, type CourseId } from '@/lib/courseThemes';
import { VTSD_COLOR, VTSD_LAYOUT_A4 } from '@/lib/vtsd-design-system';
import { getFriendlyErrorMessage } from '@/lib/anthropic-error';
import { ensureOpenRouterKey } from '@/lib/ensure-env';
import { verifyOpenRouterApiKeyForCompletions } from '@/lib/openrouter';
import { generateThreeStudyQuestions } from '@/lib/study-questions-agent';
import { paginateLongContentPages } from '@/lib/paginate-content-pages';
import { VTSD_CONCLUSAO_TITULO, vtsdConclusaoBlocoPrincipal } from '@/lib/vtsd-conclusao-copy';
import { applyNanoBananaImagesToPaginas } from '@/lib/gemini-nano-banana-images';

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

/** Extrai texto do conteúdo já gerado para fundamentar perguntas de atividades. */
function buildTextExcerptFromConteudo(conteudo: Record<string, unknown>, maxChars: number): string {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas)) return '';
  const parts: string[] = [];
  for (const p of paginas) {
    if (String(p.tipo) !== 'conteudo') continue;
    const bp = String(p.bloco_principal || '').trim();
    if (bp) parts.push(bp);
    const blocks = p.content_blocks as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        if (String(b.type) === 'text') {
          const c = String(b.content || '').trim();
          if (c) parts.push(c);
        }
      }
    }
  }
  return parts.join('\n\n').slice(0, maxChars);
}

/** Inclui página de atividades (perguntas + linhas para resposta) antes da conclusão VTSD. */
function injectAtividadesFinaisPage(
  obj: Record<string, unknown>,
  perguntas: string[]
): Record<string, unknown> {
  if (!perguntas.length) return obj;
  const paginas = obj.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas)) return obj;
  return {
    ...obj,
    paginas: [
      ...paginas,
      {
        tipo: 'atividades_finais',
        titulo_bloco: 'Atividades',
        titulo: 'Atividades sobre o conteúdo',
        perguntas,
        linhas_resposta: 5,
      },
    ],
  };
}

/** Anexa página de conclusão ao final (VTSD — arte + texto fixo em `vtsd-conclusao-copy`). */
function injectVtsdConclusaoPage(conteudo: Record<string, unknown>): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length === 0) return conteudo;
  if (paginas.some((p) => String(p.tipo) === 'conclusao_ref')) return conteudo;
  return {
    ...conteudo,
    paginas: [
      ...paginas,
      {
        tipo: 'conclusao_ref',
        titulo: VTSD_CONCLUSAO_TITULO,
        bloco_principal: vtsdConclusaoBlocoPrincipal(),
      },
    ],
  };
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
      const curIt = Array.isArray(current.itens) ? (current.itens as string[]) : [];
      const nextIt = Array.isArray(next.itens) ? (next.itens as string[]) : [];
      current.itens = [...curIt, ...nextIt].slice(0, 8);
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
      itens: Array.isArray(p.itens)
        ? (p.itens as unknown[]).map((s) => String(s).trim().slice(0, 96)).filter(Boolean)
        : undefined,
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

  /** Subconjunto do catálogo fechado — só layouts estáveis no PageConteudo / Figma. */
  const VTSD_BASE_LAYOUTS = [...VTSD_ALTERNATION_POOL] as const;

  const paginasComDesign = paginas.map((p, i) => {
    const tipo = p.tipo as string | undefined;
    let layoutTipo: string;
    if (isVtsd && tipo === 'conteudo') {
      layoutTipo = VTSD_BASE_LAYOUTS[i % VTSD_BASE_LAYOUTS.length];
    } else {
      layoutTipo =
        tipo === 'capa'
          ? 'header_destaque'
          : tipo === 'contracapa'
            ? 'header_destaque'
            : tipo === 'conclusao_ref'
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

/**
 * VTSD: força alternância visual dos layouts A4 nas páginas de conteúdo.
 * Evita sequência repetitiva quando o design-agent retorna o mesmo layout em várias páginas.
 */
/**
 * Alterna layouts VTSD garantindo variação visual real.
 * Analisa o conteúdo de cada página para escolher o layout mais adequado,
 * e nunca repete o mesmo layout em páginas consecutivas.
 */
function alternateVtsdContentLayouts(conteudo: Record<string, unknown>): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length === 0) return conteudo;

  // Pool de layouts base — embaralhados a cada geração para nunca repetir o padrão
  // Pool expandido: inclui templates novos do Figma (com renderizadores dedicados)
  const BASE_POOL = [...VTSD_ALTERNATION_POOL];
  // Fisher-Yates shuffle para randomizar a cada geração
  const shuffled = [...BASE_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Dobrar para ter sequência longa sem repetição consecutiva
  const LAYOUT_SEQUENCE = [...shuffled, ...shuffled.reverse()];

  let contentIndex = 0;
  let lastLayout = '';

  const alternadas = paginas.map((p) => {
    if ((p.tipo as string | undefined) !== 'conteudo') return p;

    const currentLayout = (p.layout_tipo as string) || '';

    // Se o design-agent já atribuiu um layout válido do pool de alternância, manter
    const BASE_SET = new Set(VTSD_ALTERNATION_POOL);
    if (BASE_SET.has(currentLayout) && currentLayout !== lastLayout) {
      lastLayout = currentLayout;
      contentIndex += 1;
      return p;
    }

    const hasItens = Array.isArray(p.itens) && (p.itens as string[]).length > 0;
    const hasGrafico = Boolean(p.sugestao_grafico);
    const hasFluxograma = Boolean(p.sugestao_fluxograma);
    const hasTabela = Boolean(p.sugestao_tabela);
    const hasImagem = Boolean(p.sugestao_imagem || p.imagem_url);
    const hasDestaques = Array.isArray(p.destaques) && (p.destaques as string[]).length > 0;
    const hasCitacao = Boolean(p.citacao);

    // Escolher layout baseado no conteúdo
    let bestLayout: string;

    if (hasGrafico || hasTabela || hasImagem) {
      bestLayout = 'A4_4_magazine';
    } else if (hasFluxograma || (hasItens && (p.itens as string[]).length >= 3)) {
      bestLayout = 'A4_3_sidebar_steps';
    } else if (contentIndex === 0) {
      bestLayout = 'A4_1_abertura';
    } else if (hasDestaques && hasCitacao) {
      bestLayout = 'A4_2_conteudo_misto';
    } else {
      bestLayout = LAYOUT_SEQUENCE[contentIndex % LAYOUT_SEQUENCE.length];
    }

    // NUNCA repetir consecutivamente
    if (bestLayout === lastLayout) {
      const alternatives = VTSD_ALTERNATION_POOL.filter((l) => l !== lastLayout);
      bestLayout = alternatives[0] ?? 'A4_2_conteudo_misto';
    }

    lastLayout = bestLayout;
    contentIndex += 1;

    return {
      ...p,
      layout_tipo: bestLayout,
    };
  });

  return { ...conteudo, paginas: alternadas };
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
    if (process.env.OPENROUTER_SKIP_KEY_VERIFY !== '1') {
      const verified = await verifyOpenRouterApiKeyForCompletions(apiKey);
      if (!verified.ok) {
        return NextResponse.json({ error: verified.message }, { status: 401 });
      }
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
          // Em "completo", usar IA com critérios de densidade evita saída curta do parser estruturado.
          conteudo = (await generateContent(transcricao, 'completo', nomeCurso)) as unknown as Record<string, unknown>;
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
        const textoDoConteudoGerado = buildTextExcerptFromConteudo(conteudo as Record<string, unknown>, 12_000);
        const textoRef = [textoDoConteudoGerado, transcricao].filter((s) => s.trim().length > 0).join('\n\n---\n\n').slice(0, 16_000);
        perguntas = await generateThreeStudyQuestions({
          titulo: tituloMat,
          subtituloCurso: subtituloMat,
          textoBase: textoRef,
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

    // OTIMIZAÇÃO: Para VTSD, pular design-agent (economiza ~8K tokens, ~30s).
    // O design é 100% programático — cores fixas, layouts determinados pelo conteúdo.
    if (cursoId === 'geral') {
      console.log('[api/generate] VTSD: usando design programático (sem design-agent)');
      conteudoComDesign = applyDefaultDesign(conteudoRecord, tema, cursoId);
    } else {
      try {
        const conteudoReduzido = buildContentForDesign(conteudoRecord);
        const designRetorno = await generateDesign(conteudoReduzido, temaParaDesign);
        conteudoComDesign = mergeDesignIntoContent(conteudoRecord, designRetorno);
      } catch (designErr) {
        console.warn('[api/generate] Design-agent falhou, aplicando design padrão:', designErr);
        conteudoComDesign = applyDefaultDesign(conteudoRecord, tema, cursoId);
      }
    }

    // Garantir que design e conteudo tenham "paginas" (normalizar se a IA retornar "pages")
    const normalizePaginas = (obj: Record<string, unknown>): Record<string, unknown> => {
      const paginas = (obj.paginas ?? obj.pages) as unknown[] | undefined;
      if (!Array.isArray(paginas)) return obj;
      return { ...obj, paginas };
    };

    /** Normaliza layout_tipo para a lista fechada do catálogo Figma (evita valores inventados pela IA). */
    const conteudoValidado = sanitizeConteudoLayouts(
      conteudoComDesign as Record<string, unknown>,
      cursoId === 'geral'
    );
    const conteudoComLayoutAlternado =
      cursoId === 'geral'
        ? alternateVtsdContentLayouts(conteudoValidado as Record<string, unknown>)
        : (conteudoValidado as Record<string, unknown>);

    const conteudoPaginado = paginateLongContentPages(conteudoComLayoutAlternado);
    const normalized = normalizePaginas(conteudoPaginado) as Record<string, unknown>;
    /** Páginas de continuação ganham A4_2_continuacao — garantir lista fechada após paginar. */
    const normalizedLayouts = sanitizeConteudoLayouts(normalized, cursoId === 'geral');
    const withAtividades =
      perguntas && perguntas.length > 0
        ? injectAtividadesFinaisPage(normalizedLayouts, perguntas)
        : normalizedLayouts;
    const finalNorm =
      cursoId === 'geral' ? injectVtsdConclusaoPage(withAtividades) : withAtividades;

    // Garantir que pelo menos 2 páginas de conteúdo tenham sugestao_imagem
    const finalPaginas = finalNorm.paginas as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(finalPaginas)) {
      const contentPages = finalPaginas.filter(p => (p.tipo as string) === 'conteudo' && !p.continuacao);
      const pagesWithImage = contentPages.filter(p => p.sugestao_imagem || p.prompt_imagem);
      const MAX_IMAGES = 2;
      if (pagesWithImage.length < MAX_IMAGES && contentPages.length >= 3) {
        let added = 0;
        for (const p of contentPages) {
          if (added >= MAX_IMAGES - pagesWithImage.length) break;
          if (p.sugestao_imagem || p.prompt_imagem) continue;
          const titulo = (p.titulo_bloco || p.titulo || 'conteúdo') as string;
          p.sugestao_imagem = `Fotografia profissional sobre: ${titulo}. Cena realista com pessoas em ambiente de trabalho ou estudo, iluminação natural, composição editorial.`;
          added++;
          console.log(`[api/generate] Auto-added image suggestion for page: ${titulo}`);
        }
      }

      // Gerar imagens (Gemini direto → OpenRouter fallback)
      try {
        await applyNanoBananaImagesToPaginas(finalPaginas as Array<{ sugestao_imagem?: string; prompt_imagem?: string; imagem_url?: string; content_blocks?: Array<{ type?: string; content?: string; imagem_url?: string; prompt_imagem?: string }> }>);
      } catch (imgErr) {
        console.warn('[api/generate] Image generation failed (non-blocking):', imgErr);
      }

      // Contar imagens geradas
      const imgCount = finalPaginas.filter(p => p.imagem_url).length;
      console.log(`[api/generate] Imagens geradas: ${imgCount}/${finalPaginas.length} páginas`);
    }

    return NextResponse.json({
      conteudo: { ...finalNorm, paginas: finalNorm.paginas ?? [] },
      design: { ...finalNorm, paginas: finalNorm.paginas ?? [] },
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
