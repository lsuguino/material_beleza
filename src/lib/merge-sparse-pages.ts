/**
 * Auto-merge de páginas magras adjacentes que pertencem ao mesmo tópico.
 * Roda no pipeline pós-paginate, antes do injectTopicOpeners.
 *
 * Caso típico que resolve: continuação automática que ficou com 30 chars de
 * texto sobrando — em vez de virar página solta com 95% de espaço vazio,
 * absorve de volta na página anterior do mesmo tópico.
 */

const SPARSE_BLOCO_THRESHOLD = 250;
const MAX_MERGED_BLOCO_CHARS = 800;

function isPageSparse(p: Record<string, unknown>): boolean {
  const bloco = String(p.bloco_principal ?? '').trim();
  if (bloco.length >= SPARSE_BLOCO_THRESHOLD) return false;

  const itensCount = Array.isArray(p.itens) ? (p.itens as unknown[]).length : 0;
  if (itensCount >= 3) return false;

  // Páginas com elementos visuais estruturados não são "magras" — ocupam o espaço.
  if (p.sugestao_tabela || p.sugestao_grafico || p.sugestao_fluxograma) return false;
  if (p.imagem_url || p.sugestao_imagem) return false;
  if (Array.isArray(p.content_blocks) && (p.content_blocks as unknown[]).length > 0) return false;

  return true;
}

function sameTopic(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  // b é continuação automática da a → mesmo tópico por construção
  if (b.continuacao) return true;
  const at = String(a.titulo_bloco ?? '').trim();
  const bt = String(b.titulo_bloco ?? '').trim();
  return at.length > 0 && at === bt;
}

function canMergePair(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aTipo = String(a.tipo ?? 'conteudo');
  const bTipo = String(b.tipo ?? 'conteudo');
  if (aTipo !== 'conteudo' || bTipo !== 'conteudo') return false;
  // Não funde openers injetados (eles têm o titulo igual à próxima página por design)
  if (a._isTopicOpener || b._isTopicOpener) return false;
  if (!sameTopic(a, b)) return false;
  // Pelo menos uma das páginas deve estar magra
  if (!isPageSparse(a) && !isPageSparse(b)) return false;
  // O resultado tem que caber sem estourar overflow
  const combined =
    String(a.bloco_principal ?? '').trim().length +
    String(b.bloco_principal ?? '').trim().length;
  return combined <= MAX_MERGED_BLOCO_CHARS;
}

function mergePages(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const concatString = (x: unknown, y: unknown): string => {
    const xs = String(x ?? '').trim();
    const ys = String(y ?? '').trim();
    return [xs, ys].filter(Boolean).join('\n\n');
  };
  const concatArray = <T>(x: unknown, y: unknown, max: number): T[] => {
    const xs = Array.isArray(x) ? (x as T[]) : [];
    const ys = Array.isArray(y) ? (y as T[]) : [];
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of [...xs, ...ys]) {
      const key = typeof item === 'string' ? item.trim() : JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= max) break;
    }
    return out;
  };

  const merged: Record<string, unknown> = {
    ...a,
    bloco_principal: concatString(a.bloco_principal, b.bloco_principal),
    itens: concatArray<string>(a.itens, b.itens, 8),
    destaques: concatArray<string>(a.destaques, b.destaques, 4),
    citacao: a.citacao || b.citacao || undefined,
  };

  const aBlocks = Array.isArray(a.content_blocks) ? a.content_blocks : [];
  const bBlocks = Array.isArray(b.content_blocks) ? b.content_blocks : [];
  if (aBlocks.length || bBlocks.length) {
    merged.content_blocks = [...aBlocks, ...bBlocks];
  }

  // Página unida não é mais "continuação" de nada — limpa flag estrutural
  delete merged.continuacao;

  return merged;
}

/**
 * Percorre páginas e une consecutivas magras do mesmo tópico.
 * Loop greedy: se A+B ficar ainda magro, próxima passada tenta unir com C.
 */
export function autoMergeSparsePages(
  conteudo: Record<string, unknown>,
): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length < 2) return conteudo;

  const out: Array<Record<string, unknown>> = [paginas[0]];
  let mergedCount = 0;

  for (let i = 1; i < paginas.length; i++) {
    const prev = out[out.length - 1];
    const curr = paginas[i];

    if (canMergePair(prev, curr)) {
      out[out.length - 1] = mergePages(prev, curr);
      mergedCount += 1;
    } else {
      out.push(curr);
    }
  }

  if (mergedCount > 0) {
    console.log(
      `[auto-merge-sparse] ${mergedCount} página(s) magra(s) unidas; ` +
        `${paginas.length} → ${out.length} páginas no total`,
    );
  }

  return { ...conteudo, paginas: out };
}
