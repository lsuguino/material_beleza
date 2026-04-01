/**
 * Geração de imagens para materiais didáticos.
 * Prioridade: OpenRouter (`OPENROUTER_MODEL_IMAGE` + `OPENROUTER_API_KEY`).
 * Fallback: API Google Gemini direta (`GEMINI_API_KEY`).
 * @see https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */

import { openRouterGenerateImage } from '@/lib/openrouter';

const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Modelo padrão: Gemini 2.5 Flash Image (Nano Banana). Sobrescreva com GEMINI_IMAGE_MODEL. */
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

function getImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}

type GeminiImagePart = {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

function extractImageFromResponse(data: unknown): { mime: string; base64: string } | null {
  const root = data as Record<string, unknown>;
  const candidates = root.candidates as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as GeminiImagePart[] | undefined;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (!inline?.data) continue;
    const mime = String(
      (inline as { mimeType?: string; mime_type?: string }).mimeType ||
        (inline as { mime_type?: string }).mime_type ||
        'image/png'
    );
    return { mime, base64: String(inline.data) };
  }
  return null;
}

/**
 * Gera uma imagem a partir do prompt (descrição didática).
 * Retorna data URL ou null em falha.
 */
export async function generateNanoBananaImage(
  apiKey: string,
  prompt: string
): Promise<string | null> {
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length < 6) return null;

  const model = getImageModel();
  const url = `${GEMINI_GENERATE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const didacticPrefix =
    'Professional clean educational illustration for a printed course handout (A4), clear composition, no overlaid text unless essential. ';
  const fullPrompt = `${didacticPrefix}${trimmed}`.slice(0, 8000);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
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
    console.error('[gemini-image] JSON inválido:', rawText.slice(0, 400));
    return null;
  }

  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message || rawText.slice(0, 300);
    console.error('[gemini-image]', res.status, msg);
    return null;
  }

  const img = extractImageFromResponse(data);
  if (!img) {
    console.warn('[gemini-image] Nenhuma parte de imagem na resposta');
    return null;
  }

  return `data:${img.mime};base64,${img.base64}`;
}

/**
 * Tenta OpenRouter (Nano Banana via slug `OPENROUTER_MODEL_IMAGE`),
 * depois Gemini direto se `GEMINI_API_KEY` estiver definida.
 */
export async function generateMaterialImage(prompt: string): Promise<string | null> {
  const viaOr = await openRouterGenerateImage(prompt);
  if (viaOr) return viaOr;

  const gk = process.env.GEMINI_API_KEY?.trim();
  if (!gk) return null;
  return generateNanoBananaImage(gk, prompt);
}

export interface PaginaComImagem {
  prompt_imagem?: unknown;
  sugestao_imagem?: unknown;
  content_blocks?: unknown;
  imagem_url?: unknown;
  [key: string]: unknown;
}

/**
 * Terceira etapa do pipeline: preenche `imagem_url` em cada página e nos blocos `type: image`.
 * Usa `generateMaterialImage` (OpenRouter ou Gemini). Cache por prompt na mesma requisição.
 */
export async function applyNanoBananaImagesToPaginas(paginas: PaginaComImagem[]): Promise<void> {
  const cache = new Map<string, string>();

  async function generateCached(prompt: string): Promise<string | null> {
    const key = prompt.trim().toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    const dataUrl = await generateMaterialImage(prompt);
    if (dataUrl) cache.set(key, dataUrl);
    return dataUrl;
  }

  for (const pagina of paginas) {
    const blocks = pagina.content_blocks;
    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (!block || typeof block !== 'object') continue;
        const b = block as Record<string, unknown>;
        const t = String(b.type || '').toLowerCase();
        if (t !== 'image') continue;
        if (b.imagem_url || b.imageUrl) continue;
        const p = String(b.content ?? b.prompt_imagem ?? '').trim();
        if (p.length < 6) continue;
        const url = await generateCached(p);
        if (url) {
          b.imagem_url = url;
          b.imageUrl = url;
        }
      }
    }

    if (pagina.imagem_url && String(pagina.imagem_url).startsWith('data:')) continue;

    const pagePrompt = String(pagina.prompt_imagem || pagina.sugestao_imagem || '').trim();
    if (pagePrompt.length < 6) continue;

    const url = await generateCached(pagePrompt);
    if (url) pagina.imagem_url = url;
  }
}
