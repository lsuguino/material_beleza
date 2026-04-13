/**
 * Divide páginas `conteudo` com texto longo demais para caber numa única folha A4,
 * em sequência de páginas com `continuacao: true` (mesmo `capitulo_seq` que o sumário).
 */

/** Orçamento aproximado de caracteres de `bloco_principal` por layout (A4 595×842, corpo principal). */
/**
 * Budget de caracteres por layout — baseado na área REAL disponível no Figma.
 *
 * Cálculo: (largura_texto × altura_texto) / (fontSize × lineHeight) × fator
 * - Sidebar 370px: coluna texto = 225px → ~600 chars
 * - Sidebar 225px: coluna texto = 370px → ~900 chars
 * - Full width: coluna texto = 495px → ~1200 chars
 * - Full com header teal: ~1000 chars (menos altura)
 */
export function budgetCharsForLayout(layoutTipo: string): number {
  switch (layoutTipo) {
    // Abertura: header teal grande (370px) + coluna texto pequena (225px)
    case 'A4_1_abertura':
      return 600;

    // Conteúdo misto: callout topo + body + callout base → body reduzido
    case 'A4_2_conteudo_misto':
      return 900;

    // Continuação: barra teal fina + body quase full → mais espaço
    case 'A4_2_continuacao':
      return 1400;

    // Texto corrido: título + parágrafos (sem header teal)
    case 'A4_2_texto_corrido':
      return 1200;

    // Texto com citação: header teal + body + citação
    case 'A4_2_texto_citacao':
      return 900;

    // Texto com sidebar fina (60px): quase full width
    case 'A4_2_texto_sidebar':
      return 1100;

    // Sidebar steps: sidebar GRANDE (370px) → coluna texto = 225px (muito estreita!)
    case 'A4_3_sidebar_steps':
      return 600;

    // Magazine: título + imagem + conceito → pouco texto
    case 'A4_4_magazine':
      return 800;

    // Sidebar conteúdo: sidebar 225px → coluna texto = 370px
    case 'A4_7_sidebar_conteudo':
      return 900;

    // Imagem com texto: imagem 300px topo → corpo reduzido
    case 'A4_2_texto_imagem':
    case 'A4_2_imagem_texto':
    case 'imagem_top':
    case 'imagem_lateral':
      return 700;

    // Duas colunas: cada coluna ~247px
    case 'dois_colunas':
    case 'A4_2_duas_colunas':
      return 1000;

    // Destaque numérico: grid de cards → pouco texto por card
    case 'A4_4_destaque_numerico':
      return 500;

    // Lista ícones: itens com ícone
    case 'lista_icones':
    case 'A4_6_lista_icones':
      return 800;

    // Dados gráfico: gráfico + insights
    case 'dados_grafico':
    case 'A4_5_grafico_analise':
      return 700;

    // Header destaque: header grande → corpo menor
    case 'header_destaque':
      return 900;

    // Citação grande: texto grande centralizado → muito pouco texto
    case 'citacao_grande':
    case 'A4_8_citacao_destaque':
    case 'A4_8_frase_impacto':
      return 400;

    // FAQ, checklist, resumo
    case 'A4_6_faq':
    case 'A4_9_checklist':
    case 'A4_9_resumo_capitulo':
      return 800;

    default:
      return 1000;
  }
}

function hardSliceText(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (t.length <= maxChars) return t ? [t] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + maxChars, t.length);
    if (end < t.length) {
      const cut = t.lastIndexOf(' ', end);
      if (cut > start + Math.floor(maxChars * 0.45)) end = cut;
    }
    if (end <= start) end = Math.min(start + maxChars, t.length);
    const piece = t.slice(start, end).trim();
    if (piece) chunks.push(piece);
    start = end;
  }
  return chunks.length ? chunks : [t.slice(0, maxChars)];
}

/** Agrupa parágrafos (blocos separados por linha em branco) respeitando `maxChars`; fatia o que for maior que o teto. */
export function splitBlocoPrincipalIntoChunks(text: string, maxChars: number): string[] {
  const raw = text.trim();
  if (!raw) return [''];
  if (raw.length <= maxChars) return [raw];

  const paras = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const effectiveParas = paras.length > 0 ? paras : [raw];

  const chunks: string[] = [];
  let cur = '';

  for (const para of effectiveParas) {
    if (para.length > maxChars) {
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
      const slices = hardSliceText(para, maxChars);
      slices.slice(0, -1).forEach((c) => chunks.push(c));
      cur = slices[slices.length - 1] ?? '';
      continue;
    }
    const sep = cur ? '\n\n' : '';
    const candidate = cur + sep + para;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) chunks.push(cur);
      cur = para;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [raw.slice(0, maxChars)];
}

/** Primeira fatia com teto da página “cheia”; o restante com teto maior (continuação VTSD). */
function splitVtsdFirstAndRest(text: string, firstMax: number, restMax: number): string[] {
  const parts = splitBlocoPrincipalIntoChunks(text, firstMax);
  if (parts.length <= 1) return parts;
  const head = parts[0];
  const remainder = parts.slice(1).join('\n\n');
  const restParts = splitBlocoPrincipalIntoChunks(remainder, restMax);
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
      /* Layout pode usar parágrafos como passos; reserva moderada */
      r += 640;
    }
    return r;
  }

  return 0;
}

function effectiveBodyCharBudget(layout: string, page: Record<string, unknown>): number {
  const base = budgetCharsForLayout(layout);
  const raw = verticalExtrasReserve(layout, page);
  const reserve = Math.min(2400, Math.ceil(raw * 1.18));
  return Math.max(700, base - reserve);
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
    const firstMax = effectiveBodyCharBudget(layout, row);
    const text = String(row.bloco_principal ?? '').trim();
    const capitulo_seq = Number(row.capitulo_seq) || 0;
    const vtsd = isVtsdLayout(layout);
    const restMax = vtsd ? budgetCharsForLayout('A4_2_continuacao') : budgetCharsForLayout('A4_7_sidebar_conteudo');

    if (text.length <= firstMax) {
      out.push({ ...row, capitulo_seq, continuacao: false });
      continue;
    }

    const chunks = vtsd
      ? splitVtsdFirstAndRest(text, firstMax, restMax)
      : splitBlocoPrincipalIntoChunks(text, firstMax);
    chunks.forEach((chunk, i) => {
      if (i === 0) {
        out.push({
          ...row,
          bloco_principal: chunk,
          capitulo_seq,
          continuacao: false,
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
      cont.itens = [];
      out.push(cont);
    });
  }

  return { ...conteudo, paginas: out };
}
