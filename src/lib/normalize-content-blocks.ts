import type { ContentBlockItem } from '@/components/ContentBlocksRenderer';
import { isRenderableImageUrl } from '@/lib/image-url';

/** Texto mínimo nos blocos `text` para não duplicar `bloco_principal` no preview. */
export const MIN_CHARS_TEXT_IN_BLOCKS = 72;

const KNOWN_TYPES = new Set(['text', 'image', 'mermaid', 'chart']);

/**
 * Converte respostas da IA (ex.: example, paragraph, key_point) para o formato do preview.
 */
export function normalizeContentBlocks(raw: unknown): ContentBlockItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ContentBlockItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    let t = String(o.type ?? 'text').toLowerCase().trim();
    const c = o.content != null ? String(o.content) : '';
    if (t === 'paragraph' || t === 'example' || t === 'key_point' || t === 'heading') {
      t = 'text';
    }
    if (t === 'list' && c.trim()) {
      t = 'text';
    }
    if (!KNOWN_TYPES.has(t)) {
      if (c.trim()) out.push({ type: 'text', content: c });
      continue;
    }
    const imgUrl =
      o.imagem_url != null ? String(o.imagem_url) : o.imageUrl != null ? String(o.imageUrl) : undefined;
    const promptImagem = t === 'image' && o.prompt_imagem != null ? String(o.prompt_imagem) : undefined;
    out.push({
      type: t as ContentBlockItem['type'],
      content: c,
      ...(t === 'image' && imgUrl && isRenderableImageUrl(imgUrl) ? { imageUrl: imgUrl, imagem_url: imgUrl } : {}),
      ...(t === 'image' && promptImagem?.trim() ? { prompt_imagem: promptImagem.trim() } : {}),
    });
  }
  return out;
}

export function contentBlocksTextCharCount(blocks: ContentBlockItem[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === 'text') n += b.content.replace(/\s+/g, ' ').trim().length;
  }
  return n;
}

export function shouldAppendPageTextFallback(blocks: ContentBlockItem[], fallbackParts: string[]): boolean {
  const joined = fallbackParts.join('').trim();
  if (joined.length < 1) return false;
  return contentBlocksTextCharCount(blocks) < MIN_CHARS_TEXT_IN_BLOCKS;
}

export function collectPageTextParts(page: {
  bloco_principal?: string;
  destaques?: unknown;
  itens?: unknown;
  citacao?: unknown;
  dado_numerico?: unknown;
}): string[] {
  const fromBloco = page.bloco_principal
    ? page.bloco_principal
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const destaques = Array.isArray(page.destaques)
    ? (page.destaques as unknown[]).map((s) => String(s).trim()).filter(Boolean)
    : [];
  const itens = Array.isArray(page.itens)
    ? (page.itens as unknown[]).map((s) => String(s).trim()).filter(Boolean)
    : [];
  const parts: string[] = [...fromBloco, ...destaques, ...itens];
  if (page.citacao) parts.push(String(page.citacao).trim());
  if (page.dado_numerico) parts.push(String(page.dado_numerico).trim());
  return parts.filter(Boolean);
}

/** Partes de texto para coluna principal: bloco + itens + citação, sem destaques (reservados para bullets de exemplos). */
export function collectConceptTextParts(page: {
  bloco_principal?: string;
  itens?: unknown;
  citacao?: unknown;
  dado_numerico?: unknown;
}): string[] {
  const fromBloco = page.bloco_principal
    ? page.bloco_principal
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const itens = Array.isArray(page.itens)
    ? (page.itens as unknown[]).map((s) => String(s).trim()).filter(Boolean)
    : [];
  const parts: string[] = [...fromBloco, ...itens];
  if (page.citacao) parts.push(String(page.citacao).trim());
  if (page.dado_numerico) parts.push(String(page.dado_numerico).trim());
  return parts.filter(Boolean);
}
