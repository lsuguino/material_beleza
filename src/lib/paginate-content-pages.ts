/**
 * Divide páginas `conteudo` com texto longo demais para caber numa única folha A4,
 * em sequência de páginas com `continuacao: true` (mesmo `capitulo_seq` que o sumário).
 *
 * REGRAS FUNDAMENTAIS:
 * 1. NUNCA quebrar no meio de uma frase — sempre cortar entre sentenças completas
 * 2. Manter parágrafos inteiros sempre que possível (keep lines together)
 * 3. Meta de preenchimento: 70–85% da altura útil do corpo (respiro visual)
 *
 * PAGINAÇÃO POR ALTURA (default a partir deste PR):
 * Usa `bodyBudgetPxForLayout` de `src/lib/page-layout-metrics.ts` para calcular
 * a altura disponível para o corpo de cada layout, descontando header/sidebar/
 * footer/citação/itens/imagem. Quebra parágrafos até atingir o budget em px.
 *
 * FEATURE FLAG: `PAGINATION_BY_HEIGHT=0` volta ao modelo antigo (chars).
 * O modelo antigo fica como wrapper retroativo para `regenerate-pages/route.ts`
 * (que consome `budgetCharsForLayout` + `splitBlocoPrincipalIntoChunks`).
 */

import {
  bodyBudgetPxForLayout,
  bodyWidthForLayout,
  estimateTextHeightPx,
  estimateParagraphsHeightPx,
  FILL_RATIO_MIN,
  type PageLike,
} from './page-layout-metrics';

function isPaginationByHeightEnabled(): boolean {
  // Opt-out explícito via env var. Default: habilitado.
  const v = typeof process !== 'undefined' ? process.env.PAGINATION_BY_HEIGHT : undefined;
  return v !== '0';
}

/** Fator de preenchimento máximo da área útil (MODELO ANTIGO chars). */
const MAX_FILL_RATIO = 0.94;
/**
 * Tolerância menor de overflow (MODELO ANTIGO chars):
 * quando passar do limite, tende a quebrar antes para evitar páginas visualmente apertadas.
 */
const SOFT_SPLIT_OVERFLOW_CHARS = 100;
/**
 * Permite continuação mesmo quando o bloco restante é menor,
 * evitando espremer texto no fim da página atual (ambos os modelos).
 */
const MIN_SECOND_CHUNK_CHARS = 90;

/**
 * Budget de caracteres por layout — baseado na área REAL disponível no Figma,
 * já aplicando o fator de 80% para garantir respiro visual em cada página.
 */
export function budgetCharsForLayout(layoutTipo: string): number {
  let raw: number;
  switch (layoutTipo) {
    // Abertura / introdução de módulo: apenas título + breve descrição (NÃO texto longo)
    case 'A4_1_abertura':
      raw = 280; break;

    // Conteúdo misto: callout topo + body + callout base → body reduzido
    case 'A4_2_conteudo_misto':
      raw = 580; break;

    // Continuação: barra teal fina + body quase full → mais espaço
    case 'A4_2_continuacao':
      raw = 880; break;

    // Texto corrido: título + parágrafos (sem header teal)
    case 'A4_2_texto_corrido':
      raw = 780; break;

    // Texto com citação: header teal + body + citação
    case 'A4_2_texto_citacao':
      raw = 580; break;

    // Texto com sidebar fina (60px): quase full width
    case 'A4_2_texto_sidebar':
      raw = 720; break;

    // Sidebar steps: sidebar GRANDE (370px) → coluna texto = 225px (muito estreita!)
    case 'A4_3_sidebar_steps':
      raw = 380; break;

    // Magazine: título + imagem + conceito → pouco texto
    case 'A4_4_magazine':
      raw = 480; break;

    // Sidebar conteúdo: sidebar 225px → coluna texto = 370px
    case 'A4_7_sidebar_conteudo':
      raw = 580; break;

    // Imagem com texto: imagem 300px topo → corpo reduzido
    case 'A4_2_texto_imagem':
    case 'A4_2_imagem_texto':
    case 'imagem_top':
    case 'imagem_lateral':
      raw = 440; break;

    // Duas colunas: cada coluna ~247px
    case 'dois_colunas':
    case 'A4_2_duas_colunas':
      raw = 640; break;

    // Destaque numérico: grid de cards → pouco texto por card
    case 'A4_4_destaque_numerico':
      raw = 400; break;

    // Lista ícones: itens com ícone
    case 'lista_icones':
    case 'A4_6_lista_icones':
      raw = 640; break;

    // Dados gráfico: gráfico + insights
    case 'dados_grafico':
    case 'A4_5_grafico_analise':
      raw = 560; break;

    // Header destaque: header grande → corpo menor
    case 'header_destaque':
      raw = 720; break;

    // Citação grande: texto grande centralizado → muito pouco texto
    case 'citacao_grande':
    case 'A4_8_citacao_destaque':
    case 'A4_8_frase_impacto':
      raw = 320; break;

    // FAQ, checklist, resumo
    case 'A4_6_faq':
    case 'A4_9_checklist':
    case 'A4_9_resumo_capitulo':
      raw = 640; break;

    default:
      raw = 640; break;
  }
  return Math.round(raw * MAX_FILL_RATIO);
}

// ———————————————————————————————————————————————
//  Sentence-aware text splitting
// ———————————————————————————————————————————————

/**
 * Divide texto em sentenças. Usa regex que respeita abreviações comuns em PT-BR.
 * Cada sentença inclui o pontuação final e espaço posterior.
 */
function splitIntoSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];

  // Regex: match sentences ending with . ! ? followed by space or end of string
  // Handles: "Dr.", "Sr.", "Sra.", "Ex.", "p.", "etc.", numbers like "1.5"
  const sentences: string[] = [];
  let current = '';

  // Simple state machine: accumulate characters, break at sentence-ending punctuation
  for (let i = 0; i < t.length; i++) {
    current += t[i];
    const ch = t[i];

    // Check if this is a sentence-ending punctuation
    if ((ch === '.' || ch === '!' || ch === '?') && i < t.length - 1) {
      const next = t[i + 1];
      // Only break if followed by space + uppercase letter, or followed by newline
      if (next === ' ' || next === '\n') {
        // Check if it's an abbreviation (common PT-BR abbreviations)
        const lastWord = current.trimEnd().split(/\s/).pop() || '';
        const isAbbreviation = /^(Dr|Sr|Sra|Ex|Fig|Cap|Art|Vol|Ed|Inc|Ltd|Jr|Ltda|S\.A|etc|prof|Obs|vs|nº|p|pag|págs?|min|seg|hr|km|m|cm|mm|kg|g|mg|R\$)\.$/.test(lastWord);
        // Check if it's a decimal number (e.g., "3.5")
        const isDecimal = ch === '.' && /\d$/.test(current.slice(0, -1)) && /^\d/.test(t.slice(i + 1));

        if (!isAbbreviation && !isDecimal) {
          // Include trailing space
          if (next === ' ') {
            current += ' ';
            i++;
          }
          sentences.push(current);
          current = '';
        }
      } else if (i === t.length - 1) {
        // End of text with punctuation
        sentences.push(current);
        current = '';
      }
    }
  }

  if (current.trim()) {
    sentences.push(current);
  }

  return sentences.filter((s) => s.trim().length > 0);
}

/**
 * Agrupa sentenças em chunks respeitando maxChars.
 * REGRA: nunca quebrar no meio de uma sentença.
 * Se uma única sentença for maior que maxChars, ela fica sozinha no chunk.
 */
function groupSentencesIntoChunks(sentences: string[], maxChars: number): string[] {
  if (sentences.length === 0) return [''];
  if (sentences.length === 1) return [sentences[0].trim()];

  const chunks: string[] = [];
  let current = '';

  for (const sent of sentences) {
    const trimmed = sent.trim();
    if (!trimmed) continue;

    if (current.length === 0) {
      current = trimmed;
      continue;
    }

    const candidate = current + ' ' + trimmed;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      // Current chunk is full — push it and start new one
      chunks.push(current.trim());
      current = trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [''];
}

/**
 * Divide texto em parágrafos (separados por \n\n), depois cada parágrafo em sentenças.
 * Agrupa sentenças em chunks de maxChars, NUNCA quebrando no meio de uma sentença.
 * Parágrafos inteiros são preservados quando possível (keep lines together).
 */
export function splitBlocoPrincipalIntoChunks(text: string, maxChars: number): string[] {
  const raw = text.trim();
  if (!raw) return [''];
  if (raw.length <= maxChars) return [raw];

  // 1. Split into paragraphs
  const paras = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  // 2. Try to group whole paragraphs first (keep lines together)
  const chunks: string[] = [];
  let current = '';

  for (const para of paras) {
    // If paragraph alone exceeds budget, split it by sentences
    if (para.length > maxChars) {
      // Push current accumulator first
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      // Split this long paragraph into sentence-based chunks
      const sentences = splitIntoSentences(para);
      const subChunks = groupSentencesIntoChunks(sentences, maxChars);
      // Add all sub-chunks except the last one (which we'll try to merge with next paragraph)
      for (let i = 0; i < subChunks.length - 1; i++) {
        chunks.push(subChunks[i]);
      }
      current = subChunks[subChunks.length - 1] || '';
      continue;
    }

    // Try to add whole paragraph to current chunk
    const sep = current ? '\n\n' : '';
    const candidate = current + sep + para;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      // Current chunk is full — push it
      if (current.trim()) {
        chunks.push(current.trim());
      }
      current = para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [raw.slice(0, maxChars)];
}

/** Primeira fatia com teto da página "cheia"; o restante com teto maior (continuação VTSD). */
function splitVtsdFirstAndRest(text: string, firstMax: number, restMax: number): string[] {
  const parts = splitBlocoPrincipalIntoChunks(text, firstMax);
  if (parts.length <= 1) return parts;
  const head = parts[0];
  const remainder = parts.slice(1).join('\n\n');
  const restParts = splitBlocoPrincipalIntoChunks(remainder, restMax);
  return [head, ...restParts];
}

// ———————————————————————————————————————————————
//  Height-based splitter (novo — default)
// ———————————————————————————————————————————————

/**
 * Quebra uma ÚNICA sequência de sentenças (de um parágrafo) em sub-chunks que
 * caibam em `budgetPx`, medindo altura via estimador determinístico.
 */
function groupSentencesByHeight(
  sentences: string[],
  widthPx: number,
  budgetPx: number,
): string[] {
  if (sentences.length === 0) return [''];
  const chunks: string[] = [];
  let current = '';
  for (const rawSent of sentences) {
    const sent = rawSent.trim();
    if (!sent) continue;
    const candidate = current ? current + ' ' + sent : sent;
    const candH = estimateTextHeightPx(candidate, widthPx, 'body');
    if (candH <= budgetPx || !current) {
      // Sempre aceita a primeira sentença mesmo se estourar (garante progresso).
      current = candidate;
    } else {
      chunks.push(current);
      current = sent;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Splitter por altura: divide `text` em chunks que caibam em `budgetPx` de
 * altura quando renderizados em coluna de largura `widthPx`, estilo 'body'.
 *
 * Preferência de quebra: parágrafo inteiro > sentença > palavra (último caso).
 */
export function splitBlocoPrincipalByHeightPx(
  text: string,
  widthPx: number,
  budgetPx: number,
  gapBetweenParagraphs = 12,
): string[] {
  const raw = text.trim();
  if (!raw) return [''];
  if (budgetPx <= 0) return [raw];

  const paras = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (paras.length === 0) return [raw];

  // Cabe tudo em um só chunk? Retorna direto.
  const totalH = estimateParagraphsHeightPx(paras, widthPx, 'body', gapBetweenParagraphs);
  if (totalH <= budgetPx) return [raw];

  const chunks: string[] = [];
  let currentParas: string[] = [];
  let currentH = 0;

  const flushCurrent = () => {
    if (currentParas.length > 0) {
      chunks.push(currentParas.join('\n\n'));
      currentParas = [];
      currentH = 0;
    }
  };

  for (const para of paras) {
    const pH = estimateTextHeightPx(para, widthPx, 'body');
    const gapH = currentParas.length > 0 ? gapBetweenParagraphs : 0;

    if (pH > budgetPx) {
      // Parágrafo gigantesco que sozinho não cabe numa página: quebra por sentenças.
      flushCurrent();
      const sentences = splitIntoSentences(para);
      const subChunks = groupSentencesByHeight(sentences, widthPx, budgetPx);
      // Empilha todos exceto o último; último vira "current" para mergear com próximo parágrafo.
      for (let i = 0; i < subChunks.length - 1; i++) chunks.push(subChunks[i]);
      const tail = subChunks[subChunks.length - 1];
      if (tail) {
        currentParas = [tail];
        currentH = estimateTextHeightPx(tail, widthPx, 'body');
      }
      continue;
    }

    // Tenta encaixar parágrafo inteiro na página atual.
    if (currentH + gapH + pH <= budgetPx) {
      currentParas.push(para);
      currentH += gapH + pH;
    } else {
      flushCurrent();
      currentParas = [para];
      currentH = pH;
    }
  }

  flushCurrent();

  return chunks.length > 0 ? chunks : [raw];
}

/**
 * Versão VTSD por altura: primeira página usa o budget do layout original;
 * continuações usam o budget de `A4_2_continuacao` (bem maior, quase full).
 */
function splitVtsdFirstAndRestByHeight(
  text: string,
  layout: string,
  page: PageLike,
): string[] {
  const firstBudget = bodyBudgetPxForLayout(layout, page);
  const continuationBudget = bodyBudgetPxForLayout('A4_2_continuacao', { continuacao: true });
  const widthPx = bodyWidthForLayout(layout);
  const contWidthPx = bodyWidthForLayout('A4_2_continuacao');

  const firstParts = splitBlocoPrincipalByHeightPx(text, widthPx, firstBudget);
  if (firstParts.length <= 1) return firstParts;
  const head = firstParts[0];
  const remainder = firstParts.slice(1).join('\n\n');
  const restParts = splitBlocoPrincipalByHeightPx(remainder, contWidthPx, continuationBudget);
  return [head, ...restParts];
}

function isVtsdLayout(layout: string): boolean {
  return layout.startsWith('A4_');
}

/**
 * Reduz o teto de caracteres do corpo quando a página tem citação em caixa e/ou lista numerada,
 * para não estourar a altura útil (842px − margens) no PDF — evita corte no rodapé.
 */
function verticalExtrasReserve(layout: string, page: Record<string, unknown>): number {
  if (layout === 'A4_2_continuacao') return 0;

  const q = String(page.citacao ?? '').trim();
  const itens = Array.isArray(page.itens)
    ? (page.itens as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const dest = Array.isArray(page.destaques)
    ? (page.destaques as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];

  let r = 0;

  if (layout === 'A4_7_sidebar_conteudo') {
    if (q.length) {
      r += 540;
      r += Math.min(520, Math.floor(q.length * 0.38));
    }
    const steps = itens.length > 0 ? itens : dest;
    for (const line of steps) {
      r += 210 + Math.min(130, Math.floor(String(line).length * 0.14));
    }
    return r;
  }

  if (layout === 'A4_3_sidebar_steps') {
    if (q.length) {
      r += 500;
      r += Math.min(450, Math.floor(q.length * 0.32));
    }
    const steps = itens.length > 0 ? itens : dest;
    if (steps.length > 0) {
      const n = Math.min(4, steps.length);
      for (let i = 0; i < n; i++) {
        const line = String(steps[i] ?? '');
        r += 215 + Math.min(110, Math.floor(line.length * 0.13));
      }
    } else {
      r += 640;
    }
    return r;
  }

  // Reserva genérica para citação e itens em qualquer layout
  if (q.length) r += 300;
  if (itens.length > 0) r += itens.length * 120;
  if (dest.length > 0) r += dest.length * 100;

  return r;
}

function effectiveBodyCharBudget(layout: string, page: Record<string, unknown>): number {
  const base = budgetCharsForLayout(layout);
  const raw = verticalExtrasReserve(layout, page);
  const reserve = Math.min(2400, Math.ceil(raw * 1.02));
  return Math.max(240, base - reserve);
}

function collectStepItems(page: Record<string, unknown>): string[] {
  const itens = Array.isArray(page.itens)
    ? (page.itens as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (itens.length > 0) return itens;
  const destaques = Array.isArray(page.destaques)
    ? (page.destaques as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  return destaques;
}

function shouldMoveStepsToContinuation(layout: string, page: Record<string, unknown>): boolean {
  if (layout !== 'A4_3_sidebar_steps' && layout !== 'A4_7_sidebar_conteudo') return false;
  const steps = collectStepItems(page);
  if (!steps.length) return false;
  const totalChars = steps.reduce((acc, s) => acc + s.length, 0);
  const longest = steps.reduce((acc, s) => Math.max(acc, s.length), 0);
  return steps.length >= 4 || totalChars > 260 || longest > 95;
}

/**
 * Atribui `capitulo_seq` (1-based, alinhado ao sumário) e quebra páginas `conteudo` estouradas.
 * Curso VTSD (A4_*): continuações → `A4_2_continuacao` (sem capítulo na lateral). Demais cursos → `A4_7_sidebar_conteudo`.
 */
export function paginateLongContentPages(conteudo: Record<string, unknown>): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length === 0) return conteudo;

  let seq = 0;
  const numbered = paginas.map((p) => {
    if (p.tipo !== 'conteudo') return { ...p };
    seq += 1;
    return { ...p, capitulo_seq: seq };
  });

  const out: Array<Record<string, unknown>> = [];

  for (const p of numbered) {
    const row = p as Record<string, unknown>;
    if (row.tipo !== 'conteudo') {
      out.push(row);
      continue;
    }

    const layout = String(row.layout_tipo || 'A4_7_sidebar_conteudo');
    const text = String(row.bloco_principal ?? '').trim();
    const capitulo_seq = Number(row.capitulo_seq) || 0;
    const vtsd = isVtsdLayout(layout);
    const useHeight = isPaginationByHeightEnabled() && vtsd;
    const moveStepsToContinuation = shouldMoveStepsToContinuation(layout, row);

    // ———— Modelo por altura (default, VTSD) ————
    if (useHeight) {
      const pageLike: PageLike = {
        titulo: row.titulo as string | undefined,
        subtitulo: row.subtitulo as string | undefined,
        citacao: row.citacao as string | undefined,
        itens: Array.isArray(row.itens) ? (row.itens as string[]) : undefined,
        destaques: Array.isArray(row.destaques) ? (row.destaques as string[]) : undefined,
        imagem_url: row.imagem_url as string | undefined,
        sugestao_imagem: row.sugestao_imagem,
        capitulo_seq,
      };
      const firstBudgetPx = bodyBudgetPxForLayout(layout, pageLike);
      const widthPx = bodyWidthForLayout(layout);
      const textHeightPx = estimateParagraphsHeightPx(
        text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
        widthPx,
        'body',
        12,
      );

      // Cabe numa página só? (inclui tolerância para fill ratio mínimo)
      if (textHeightPx <= firstBudgetPx) {
        const firstPage = {
          ...row,
          capitulo_seq,
          continuacao: false,
          ...(moveStepsToContinuation ? { itens: [], destaques: [] } : {}),
        };
        out.push(firstPage);
        if (moveStepsToContinuation) {
          out.push({
            ...row,
            layout_tipo: 'A4_2_continuacao',
            bloco_principal: '',
            capitulo_seq,
            continuacao: true,
            titulo: undefined,
            titulo_bloco: undefined,
            subtitulo: undefined,
            destaques: Array.isArray(row.destaques) ? row.destaques : [],
            citacao: undefined,
            content_blocks: undefined,
            sugestao_imagem: undefined,
            prompt_imagem: undefined,
            sugestao_grafico: undefined,
            sugestao_fluxograma: undefined,
            sugestao_tabela: undefined,
            imagem_url: undefined,
            itens: Array.isArray(row.itens) ? row.itens : [],
          });
        }
        continue;
      }

      const chunks = splitVtsdFirstAndRestByHeight(text, layout, pageLike);

      // Evita "órfão" muito curto na última continuação apenas se a fusão com a
      // penúltima NÃO estoura o budget dela. Threshold conservador (8% do budget
      // da continuação ≈ 2 linhas) — previne continuação com ~50 chars.
      if (chunks.length >= 2) {
        const lastChunk = chunks[chunks.length - 1];
        const prevChunk = chunks[chunks.length - 2];
        const contWidthPx = bodyWidthForLayout('A4_2_continuacao');
        const contBudgetPx = bodyBudgetPxForLayout('A4_2_continuacao', { continuacao: true });
        const lastH = estimateTextHeightPx(lastChunk, contWidthPx, 'body');
        const mergedText = prevChunk + '\n\n' + lastChunk;
        // Budget do "prev" depende da posição: se chunks.length==2, prev é a primeira página
        // (layout original). Se >2, prev é uma continuação.
        const prevIsFirst = chunks.length === 2;
        const prevLayout = prevIsFirst ? layout : 'A4_2_continuacao';
        const prevPage = prevIsFirst ? pageLike : { continuacao: true };
        const prevWidthPx = bodyWidthForLayout(prevLayout);
        const prevBudgetPx = bodyBudgetPxForLayout(prevLayout, prevPage);
        const mergedH = estimateTextHeightPx(mergedText, prevWidthPx, 'body');
        if (lastH < contBudgetPx * 0.08 && mergedH <= prevBudgetPx) {
          chunks.splice(chunks.length - 2, 2, mergedText);
        }
      }

      chunks.forEach((chunk, i) => {
        if (i === 0) {
          out.push({
            ...row,
            bloco_principal: chunk,
            capitulo_seq,
            continuacao: false,
            ...(moveStepsToContinuation ? { itens: [], destaques: [] } : {}),
          });
          return;
        }
        const cont: Record<string, unknown> = { ...row };
        cont.layout_tipo = 'A4_2_continuacao';
        cont.bloco_principal = chunk;
        cont.capitulo_seq = capitulo_seq;
        cont.continuacao = true;
        cont.titulo = undefined;
        cont.titulo_bloco = undefined;
        cont.subtitulo = undefined;
        cont.destaques = [];
        cont.citacao = undefined;
        cont.content_blocks = undefined;
        cont.sugestao_imagem = undefined;
        cont.prompt_imagem = undefined;
        cont.sugestao_grafico = undefined;
        cont.sugestao_fluxograma = undefined;
        cont.sugestao_tabela = undefined;
        cont.imagem_url = undefined;
        if (moveStepsToContinuation && i === 1) {
          cont.itens = Array.isArray(row.itens) ? row.itens : [];
          cont.destaques = Array.isArray(row.destaques) ? row.destaques : [];
        } else {
          cont.itens = [];
          cont.destaques = [];
        }
        out.push(cont);
      });
      continue;
    }

    // ———— Modelo antigo por chars (fallback: PAGINATION_BY_HEIGHT=0 ou não-VTSD) ————
    const firstMax = effectiveBodyCharBudget(layout, row);
    const restMax = vtsd ? budgetCharsForLayout('A4_2_continuacao') : budgetCharsForLayout('A4_7_sidebar_conteudo');

    if (text.length <= firstMax || text.length <= firstMax + SOFT_SPLIT_OVERFLOW_CHARS) {
      const firstPage = {
        ...row,
        capitulo_seq,
        continuacao: false,
        ...(moveStepsToContinuation ? { itens: [], destaques: [] } : {}),
      };
      out.push(firstPage);
      if (moveStepsToContinuation) {
        out.push({
          ...row,
          layout_tipo: vtsd ? 'A4_2_continuacao' : 'A4_7_sidebar_conteudo',
          bloco_principal: '',
          capitulo_seq,
          continuacao: true,
          titulo: undefined,
          titulo_bloco: undefined,
          subtitulo: undefined,
          destaques: Array.isArray(row.destaques) ? row.destaques : [],
          citacao: undefined,
          content_blocks: undefined,
          sugestao_imagem: undefined,
          prompt_imagem: undefined,
          sugestao_grafico: undefined,
          sugestao_fluxograma: undefined,
          sugestao_tabela: undefined,
          imagem_url: undefined,
          itens: Array.isArray(row.itens) ? row.itens : [],
        });
      }
      continue;
    }

    const chunks = vtsd
      ? splitVtsdFirstAndRest(text, firstMax, restMax)
      : splitBlocoPrincipalIntoChunks(text, firstMax);
    if (chunks.length === 2 && chunks[1].trim().length < MIN_SECOND_CHUNK_CHARS) {
      out.push({
        ...row,
        capitulo_seq,
        continuacao: false,
        ...(moveStepsToContinuation ? { itens: [], destaques: [] } : {}),
      });
      if (moveStepsToContinuation) {
        out.push({
          ...row,
          layout_tipo: vtsd ? 'A4_2_continuacao' : 'A4_7_sidebar_conteudo',
          bloco_principal: '',
          capitulo_seq,
          continuacao: true,
          titulo: undefined,
          titulo_bloco: undefined,
          subtitulo: undefined,
          destaques: Array.isArray(row.destaques) ? row.destaques : [],
          citacao: undefined,
          content_blocks: undefined,
          sugestao_imagem: undefined,
          prompt_imagem: undefined,
          sugestao_grafico: undefined,
          sugestao_fluxograma: undefined,
          sugestao_tabela: undefined,
          imagem_url: undefined,
          itens: Array.isArray(row.itens) ? row.itens : [],
        });
      }
      continue;
    }
    chunks.forEach((chunk, i) => {
      if (i === 0) {
        out.push({
          ...row,
          bloco_principal: chunk,
          capitulo_seq,
          continuacao: false,
          ...(moveStepsToContinuation ? { itens: [], destaques: [] } : {}),
        });
        return;
      }

      const cont: Record<string, unknown> = { ...row };
      cont.layout_tipo = vtsd ? 'A4_2_continuacao' : 'A4_7_sidebar_conteudo';
      cont.bloco_principal = chunk;
      cont.capitulo_seq = capitulo_seq;
      cont.continuacao = true;
      cont.titulo = undefined;
      cont.titulo_bloco = undefined;
      cont.subtitulo = undefined;
      cont.destaques = [];
      cont.citacao = undefined;
      cont.content_blocks = undefined;
      cont.sugestao_imagem = undefined;
      cont.prompt_imagem = undefined;
      cont.sugestao_grafico = undefined;
      cont.sugestao_fluxograma = undefined;
      cont.sugestao_tabela = undefined;
      cont.imagem_url = undefined;
      if (moveStepsToContinuation && i === 1) {
        cont.itens = Array.isArray(row.itens) ? row.itens : [];
        cont.destaques = Array.isArray(row.destaques) ? row.destaques : [];
      } else {
        cont.itens = [];
        cont.destaques = [];
      }
      out.push(cont);
    });
  }

  return { ...conteudo, paginas: out };
}
