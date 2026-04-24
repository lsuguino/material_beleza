import {
  paginateLongContentPages,
  budgetCharsForLayout,
  splitBlocoPrincipalIntoChunks,
} from '@/lib/paginate-content-pages';
import { validatePagesOverflow } from '@/lib/validate-page-overflow';
import { openRouterChatByTask } from '@/lib/openrouter';

const MAX_ATTEMPTS = 3;
const SHRINK_FACTOR = 0.85;
const OVERFLOW_TOLERANCE_PX = 8;
const MIN_BUDGET_CHARS = 200;

/**
 * Estima quantos caracteres representam os `overflowPx` e pede pro modelo
 * mais barato (Haiku via task 'design') encurtar o `bloco_principal` preservando sentido.
 */
async function shortenBlocoPrincipalViaLLM(
  currentText: string,
  overflowPx: number,
): Promise<string> {
  const CHARS_PER_PX = 7; // estimativa grosseira: 1 linha ≈ 18px ≈ ~120 chars
  const reduction = Math.max(40, Math.ceil(overflowPx * CHARS_PER_PX));
  const targetLen = Math.max(120, currentText.length - reduction);

  try {
    const result = await openRouterChatByTask('design', {
      system:
        'Você encurta texto didático preservando sentido e fidelidade. Retorne APENAS o texto encurtado em português — sem aspas, sem markdown, sem comentários.',
      user: `Reduza este texto para aproximadamente ${targetLen} caracteres, mantendo clareza didática e mantendo os conceitos principais. Não invente informações novas; apenas condense.\n\nTexto:\n${currentText}`,
      max_tokens: 1500,
      temperature: 0.1,
    });
    const shortened = result.trim();
    if (shortened.length > 0 && shortened.length < currentText.length) return shortened;
    return currentText;
  } catch (err) {
    console.error('[paginate-with-validation] shortenBlocoPrincipalViaLLM falhou:', err);
    return currentText;
  }
}

function makeContinuationPage(
  source: Record<string, unknown>,
  chunk: string,
  isVtsd: boolean,
): Record<string, unknown> {
  return {
    ...source,
    layout_tipo: isVtsd ? 'A4_2_continuacao' : 'A4_7_sidebar_conteudo',
    bloco_principal: chunk,
    continuacao: true,
    titulo: undefined,
    titulo_bloco: undefined,
    subtitulo: undefined,
    destaques: [],
    citacao: undefined,
    content_blocks: undefined,
    sugestao_imagem: undefined,
    prompt_imagem: undefined,
    sugestao_grafico: undefined,
    sugestao_fluxograma: undefined,
    sugestao_tabela: undefined,
    imagem_url: undefined,
    itens: [],
  };
}

/**
 * Pagina o conteúdo e valida overflow no Puppeteer.
 *
 * Estratégia (3 tentativas máx por página):
 * - Tentativa 1-2: reduz o budget do layout em 15% e re-quebra o bloco_principal
 *   em chunks menores, criando continuações se necessário. Sem LLM.
 * - Tentativa 3: chama Haiku (task 'design') pra encurtar o texto preservando sentido.
 *
 * Em caso de falha do Puppeteer (ex.: dev server offline), loga e retorna o
 * conteúdo só paginado pelo método antigo — nunca quebra o fluxo principal.
 */
export async function paginateWithValidation(
  conteudo: Record<string, unknown>,
  baseUrl?: string,
): Promise<Record<string, unknown>> {
  let current = paginateLongContentPages(conteudo);
  const layoutBudgetMultiplier: Record<string, number> = {};

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let validation;
    try {
      validation = await validatePagesOverflow(current, baseUrl, OVERFLOW_TOLERANCE_PX);
    } catch (err) {
      console.error(
        `[paginate-with-validation] Validação Puppeteer falhou na tentativa ${attempt + 1}:`,
        err,
      );
      return current;
    }

    const problems = validation.pages.filter((p) => p.hasOverflow);
    if (problems.length === 0) {
      console.log(
        `[paginate-with-validation] OK — nenhuma página estoura (tentativa ${attempt + 1}, ${validation.pages.length} páginas)`,
      );
      return current;
    }

    console.log(
      `[paginate-with-validation] Tentativa ${attempt + 1}: ${problems.length}/${validation.pages.length} páginas estouram`,
    );

    const paginas = [...((current.paginas as Array<Record<string, unknown>>) || [])];
    const sortedProblems = [...problems].sort((a, b) => b.pageIndex - a.pageIndex);

    for (const prob of sortedProblems) {
      const page = paginas[prob.pageIndex];
      if (!page || page.tipo !== 'conteudo') continue;

      const layout = String(page.layout_tipo || 'A4_7_sidebar_conteudo');
      const isVtsd = layout.startsWith('A4_');
      const text = String(page.bloco_principal || '').trim();

      if (attempt < 2) {
        const currentMult = layoutBudgetMultiplier[layout] ?? 1;
        const newMult = currentMult * SHRINK_FACTOR;
        layoutBudgetMultiplier[layout] = newMult;

        const baseBudget = budgetCharsForLayout(layout);
        const newBudget = Math.max(MIN_BUDGET_CHARS, Math.floor(baseBudget * newMult));

        if (!text || text.length <= newBudget) continue;

        const chunks = splitBlocoPrincipalIntoChunks(text, newBudget);
        if (chunks.length <= 1) continue;

        const updatedPage = { ...page, bloco_principal: chunks[0] };
        const continuations = chunks.slice(1).map((c) => makeContinuationPage(page, c, isVtsd));

        paginas.splice(prob.pageIndex, 1, updatedPage, ...continuations);
      } else {
        if (!text) continue;
        const shortened = await shortenBlocoPrincipalViaLLM(text, prob.overflowPx);
        paginas[prob.pageIndex] = { ...page, bloco_principal: shortened };
      }
    }

    current = { ...current, paginas };
  }

  console.warn(
    `[paginate-with-validation] Máximo de ${MAX_ATTEMPTS} tentativas atingido; algumas páginas podem ainda estourar visualmente.`,
  );
  return current;
}
