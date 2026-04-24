import { isRenderableImageUrl } from '@/lib/image-url';

/** Campos mínimos para fusão design/conteúdo no preview (evita import circular com MaterialPreviewBlocks). */
export type MergeablePreviewPagina = {
  sugestao_imagem?: string;
  prompt_imagem?: string;
  imagem_url?: string;
  content_blocks?: unknown;
  [key: string]: unknown;
};

function isEmptyString(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== 'string') return true;
  return !v.trim();
}

/** Lê descrição/prompt em blocos `image` antes da normalização (IA costuma mandar aqui). */
export function extractImageDescriptionFromRawBlocks(raw: unknown): string {
  if (!Array.isArray(raw)) return '';
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (String(o.type ?? '').toLowerCase().trim() !== 'image') continue;
    const c = String(o.content ?? '').trim();
    const p = String(o.prompt_imagem ?? o.prompt ?? '').trim();
    const best = c.length >= 6 ? c : p.length >= 6 ? p : c || p;
    if (best.trim()) return best;
  }
  return '';
}

/**
 * O preview usa `design` primeiro; às vezes só `conteudo` traz sugestao_imagem / imagem_url.
 * Alinha página a página pelo índice.
 */
export function mergeDesignPageWithConteudo<T extends MergeablePreviewPagina>(
  designPage: T,
  conteudoPage: T | undefined
): T {
  if (!conteudoPage) return designPage;
  const out = { ...designPage } as T;
  if (isEmptyString(out.sugestao_imagem) && !isEmptyString(conteudoPage.sugestao_imagem)) {
    out.sugestao_imagem = conteudoPage.sugestao_imagem;
  }
  if (isEmptyString(out.prompt_imagem) && !isEmptyString(conteudoPage.prompt_imagem)) {
    out.prompt_imagem = conteudoPage.prompt_imagem;
  }
  if (!isRenderableImageUrl(out.imagem_url) && isRenderableImageUrl(conteudoPage.imagem_url)) {
    out.imagem_url = conteudoPage.imagem_url;
  }
  const db = designPage.content_blocks;
  const cb = conteudoPage.content_blocks;
  const designBlocksEmpty = !Array.isArray(db) || db.length === 0;
  if (designBlocksEmpty && Array.isArray(cb) && cb.length > 0) {
    out.content_blocks = cb;
  }
  return out;
}

/** Preenche sugestao_imagem a partir de blocos image quando os campos de página estão vazios. */
export function enrichPaginaImageHints<T extends MergeablePreviewPagina>(page: T): T {
  if (!isEmptyString(page.sugestao_imagem) || !isEmptyString(page.prompt_imagem)) return page;
  const fromBlocks = extractImageDescriptionFromRawBlocks(page.content_blocks);
  if (!fromBlocks.trim()) return page;
  return { ...page, sugestao_imagem: fromBlocks };
}
