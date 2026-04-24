/**
 * Geração de imagens para materiais didáticos via API Google Gemini direta (`GEMINI_API_KEY`).
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */

import { ensureGeminiApiKey } from '@/lib/ensure-env';
import { isRenderableImageUrl } from '@/lib/image-url';
import { openRouterGenerateImage } from '@/lib/openrouter';
import {
  buildImagePrompt,
  getAspectRatioForLayout,
  MAX_IMAGES_PER_MATERIAL,
  type ImageAspectRatio,
} from '@/lib/image-prompt';

const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Modelo padrão: Gemini 2.5 Flash Image (Nano Banana). Sobrescreva com GEMINI_IMAGE_MODEL. */
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

function getImageModel(): string {
  const raw = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  /** `gemini-2.5-flash` não gera imagem; só o variant *-flash-image. */
  if (raw === 'gemini-2.5-flash' || raw === 'gemini-2.5-flash-latest' || raw === 'gemini-2.5-pro') {
    return DEFAULT_GEMINI_IMAGE_MODEL;
  }
  return raw;
}

type GeminiImagePart = {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
  text?: string;
};

function partToImage(part: GeminiImagePart): { mime: string; base64: string } | null {
  const inline = part.inlineData || part.inline_data;
  if (!inline?.data) return null;
  const mime = String(
    (inline as { mimeType?: string; mime_type?: string }).mimeType ||
      (inline as { mime_type?: string }).mime_type ||
      'image/png'
  );
  return { mime, base64: String(inline.data) };
}

function extractImageFromResponse(data: unknown): { mime: string; base64: string } | null {
  const root = data as Record<string, unknown>;
  const candidates = root.candidates as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(candidates)) return null;

  for (const cand of candidates) {
    const fr = String(cand.finishReason || '');
    if (fr === 'SAFETY' || fr === 'RECITATION') continue;
    const content = cand.content as Record<string, unknown> | undefined;
    const parts = content?.parts as GeminiImagePart[] | undefined;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const img = partToImage(part);
      if (img) return img;
    }
  }
  return null;
}

function logGeminiDiagnostics(data: unknown): void {
  const root = data as Record<string, unknown>;
  const fb = root.promptFeedback as { blockReason?: string } | undefined;
  if (fb?.blockReason) console.warn('[gemini-image] promptFeedback.blockReason:', fb.blockReason);
  const candidates = root.candidates as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(candidates) && candidates[0]) {
    const c0 = candidates[0];
    console.warn('[gemini-image] candidate[0] finishReason:', c0.finishReason);
    const parts = (c0.content as { parts?: unknown[] } | undefined)?.parts;
    if (Array.isArray(parts)) {
      console.warn(
        '[gemini-image] part keys:',
        parts.map((p) => (p && typeof p === 'object' ? Object.keys(p as object).join('+') : '?')).join(' | ')
      );
    }
  }
}

async function callGeminiGenerateContent(
  apiKey: string,
  model: string,
  fullPrompt: string,
  responseModalities: string[]
): Promise<{ ok: boolean; data: unknown; status: number; rawSnippet: string }> {
  const url = `${GEMINI_GENERATE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      responseModalities,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    return { ok: false, data: null, status: res.status, rawSnippet: rawText.slice(0, 400) };
  }

  return { ok: res.ok, data, status: res.status, rawSnippet: rawText.slice(0, 200) };
}

/**
 * Gera uma imagem a partir do prompt (descrição didática).
 * Retorna data URL ou null em falha.
 */
export async function generateNanoBananaImage(
  apiKey: string,
  prompt: string,
  ratio: ImageAspectRatio = 'wide'
): Promise<string | null> {
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length < 6) return null;

  const model = getImageModel();

  const fullPrompt = buildImagePrompt(trimmed, ratio);

  const modalitySets: string[][] = [['TEXT', 'IMAGE'], ['IMAGE']];

  for (const modalities of modalitySets) {
    const { ok, data, status, rawSnippet } = await callGeminiGenerateContent(
      apiKey,
      model,
      fullPrompt,
      modalities
    );

    if (data == null) {
      console.error('[gemini-image] Resposta não-JSON', status, rawSnippet);
      continue;
    }

    if (!ok) {
      const msg =
        typeof data === 'object' ? (data as { error?: { message?: string } }).error?.message : undefined;
      console.error('[gemini-image]', status, modalities.join(','), msg || rawSnippet);
      continue;
    }

    const img = extractImageFromResponse(data);
    if (img) return `data:${img.mime};base64,${img.base64}`;

    logGeminiDiagnostics(data);
  }

  console.warn('[gemini-image] Nenhuma parte de imagem após tentativas (modelo:', model, ')');
  return null;
}

/**
 * Gera imagem via API Google Gemini direta (requer `GEMINI_API_KEY`).
 * Retorna null se a chave não estiver configurada.
 */
export async function generateMaterialImage(
  prompt: string,
  ratio: ImageAspectRatio = 'wide',
): Promise<string | null> {
  const geminiKey = await ensureGeminiApiKey();
  if (geminiKey) process.env.GEMINI_API_KEY = geminiKey;
  const gk = process.env.GEMINI_API_KEY?.trim();
  if (!gk) return null;
  return generateNanoBananaImage(gk, prompt, ratio);
}

export interface PaginaComImagem {
  prompt_imagem?: unknown;
  sugestao_imagem?: unknown;
  content_blocks?: unknown;
  imagem_url?: unknown;
  [key: string]: unknown;
}

/** Melhor prompt da página: prioriza texto longo; evita `prompt_imagem` curto que bloqueia `sugestao_imagem`. */
function resolvePageImagePrompt(pagina: PaginaComImagem): string {
  const a = String(pagina.prompt_imagem ?? '').trim();
  const b = String(pagina.sugestao_imagem ?? '').trim();
  if (a.length >= 6) return a;
  if (b.length >= 6) return b;
  return a.length > b.length ? a : b;
}

/**
 * Conta quantas imagens JÁ estão presentes (URLs válidas) nas páginas —
 * seja em `imagem_url` de página ou em content_blocks type=image.
 */
function countExistingImages(paginas: PaginaComImagem[]): number {
  let count = 0;
  for (const p of paginas) {
    if (isRenderableImageUrl(p.imagem_url)) count += 1;
    const blocks = p.content_blocks;
    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (!block || typeof block !== 'object') continue;
        const b = block as Record<string, unknown>;
        if (isRenderableImageUrl(b.imagem_url) || isRenderableImageUrl(b.imageUrl)) {
          count += 1;
        }
      }
    }
  }
  return count;
}

/**
 * Terceira etapa do pipeline: preenche `imagem_url` em cada página e nos blocos `type: image`.
 * Usa `generateMaterialImage` (OpenRouter/Gemini). Cache por prompt na mesma requisição.
 *
 * Regras:
 * - Cap rígido de MAX_IMAGES_PER_MATERIAL (2) imagens geradas por material, contando as já existentes
 * - Cada página carrega seu aspect ratio derivado do `layout_tipo` (via `getAspectRatioForLayout`)
 * - Prompt final incluirá estilo flexível (realista ou ilustração) + instrução PT-BR (via buildImagePrompt)
 */
export async function applyNanoBananaImagesToPaginas(
  paginas: PaginaComImagem[],
  cache?: Map<string, string>
): Promise<void> {
  const cacheLocal = cache ?? new Map<string, string>();
  let imagesSoFar = countExistingImages(paginas);

  if (imagesSoFar >= MAX_IMAGES_PER_MATERIAL) {
    console.log(
      `[nano-banana] Cap de ${MAX_IMAGES_PER_MATERIAL} imagens já atingido (${imagesSoFar} presentes) — nenhuma geração nova`,
    );
    return;
  }

  async function generateCached(prompt: string, ratio: ImageAspectRatio): Promise<string | null> {
    const key = `${ratio}|${prompt.trim().toLowerCase()}`;
    if (cacheLocal.has(key)) return cacheLocal.get(key)!;
    let dataUrl: string | null = null;
    try {
      console.log(`[nano-banana] Tentando OpenRouter (${ratio}) para: "${prompt.substring(0, 40)}..."`);
      dataUrl = await openRouterGenerateImage(prompt, ratio);
    } catch (e) {
      console.warn('[nano-banana] OpenRouter falhou:', e);
    }
    if (!dataUrl) {
      try {
        console.log(`[nano-banana] Tentando Gemini direto (${ratio})...`);
        dataUrl = await generateMaterialImage(prompt, ratio);
      } catch (e) {
        console.warn('[nano-banana] Gemini direto falhou:', e);
      }
    }
    if (dataUrl) {
      cacheLocal.set(key, dataUrl);
      console.log(`[nano-banana] ✅ Imagem gerada (${ratio}) para: "${prompt.substring(0, 50)}..."`);
    } else {
      console.error(`[nano-banana] ❌ NENHUM provider gerou imagem para: "${prompt.substring(0, 50)}..."`);
    }
    return dataUrl;
  }

  for (const pagina of paginas) {
    if (imagesSoFar >= MAX_IMAGES_PER_MATERIAL) break;

    const layoutTipo = String(pagina.layout_tipo ?? '') || undefined;
    const tipo = String(pagina.tipo ?? '') || undefined;
    const ratio = getAspectRatioForLayout(layoutTipo, tipo);

    const blocks = pagina.content_blocks;
    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (imagesSoFar >= MAX_IMAGES_PER_MATERIAL) break;
        if (!block || typeof block !== 'object') continue;
        const b = block as Record<string, unknown>;
        const t = String(b.type || '').toLowerCase();
        if (t !== 'image') continue;
        if (isRenderableImageUrl(b.imagem_url) || isRenderableImageUrl(b.imageUrl)) continue;
        const fromContent = String(b.content ?? '').trim();
        const fromPrompt = String(b.prompt_imagem ?? '').trim();
        const p = fromContent.length >= 6 ? fromContent : fromPrompt.length >= 6 ? fromPrompt : fromContent || fromPrompt;
        if (p.length < 6) continue;
        const url = await generateCached(p, ratio);
        if (url) {
          b.imagem_url = url;
          b.imageUrl = url;
          imagesSoFar += 1;
        }
      }
    }

    if (imagesSoFar >= MAX_IMAGES_PER_MATERIAL) break;
    if (isRenderableImageUrl(pagina.imagem_url)) continue;

    const pagePrompt = resolvePageImagePrompt(pagina).trim();
    if (pagePrompt.length < 6) continue;

    const url = await generateCached(pagePrompt, ratio);
    if (url) {
      pagina.imagem_url = url;
      imagesSoFar += 1;
    }
  }

  console.log(
    `[nano-banana] Total de imagens no material: ${imagesSoFar}/${MAX_IMAGES_PER_MATERIAL}`,
  );
}
