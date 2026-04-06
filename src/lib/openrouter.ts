import { normalizeOpenRouterApiKey } from '@/lib/openrouter-key';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Referer padrão quando OPENROUTER_HTTP_REFERER não está definido (doc: opcional, mas alguns proxies exigem URL válida). */
function defaultOpenRouterReferer(): string {
  const explicit = process.env.OPENROUTER_HTTP_REFERER?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  return 'http://127.0.0.1:3000';
}

function openRouterExtraHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  h['HTTP-Referer'] = defaultOpenRouterReferer();
  const title = process.env.OPENROUTER_X_TITLE?.trim() || 'scribo';
  h['X-Title'] = title;
  h['X-OpenRouter-Title'] = title;
  return h;
}

/** Claude Sonnet 4 (Anthropic via OpenRouter) — etapa de design/layout. */
export const OPENROUTER_MODEL_CLAUDE_SONNET_4 = 'anthropic/claude-sonnet-4';

/** GPT-4o (OpenAI via OpenRouter) — etapa de texto/material didático. */
export const OPENROUTER_MODEL_GPT_4O = 'openai/gpt-4o';

export const OPENROUTER_MODELS = {
  textMaterial: OPENROUTER_MODEL_GPT_4O,
  design: OPENROUTER_MODEL_CLAUDE_SONNET_4,
} as const;

export type OpenRouterTask = 'text_material' | 'design';

function messageFromUnknownBody(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const err = o.error as { message?: string } | undefined;
    const msg = err?.message ?? (o.message as string | undefined);
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return null;
}

/** Slug do modelo no OpenRouter (ex.: anthropic/claude-3.5-sonnet). Configure OPENROUTER_MODEL no .env.local. */
export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-3.5-sonnet';
}

/**
 * Modelo por etapa: texto (`text_material`) vs design (`design`).
 * Sobrescreva com OPENROUTER_MODEL_TEXT_MATERIAL e OPENROUTER_MODEL_DESIGN no .env.local.
 */
export function getOpenRouterModelForTask(task: OpenRouterTask): string {
  const envModelText = process.env.OPENROUTER_MODEL_TEXT_MATERIAL?.trim();
  const envModelDesign = process.env.OPENROUTER_MODEL_DESIGN?.trim();
  if (task === 'text_material') return envModelText || OPENROUTER_MODELS.textMaterial;
  return envModelDesign || OPENROUTER_MODELS.design;
}

/**
 * Chamada à API Chat Completions do OpenRouter (compatível com OpenAI).
 * Usa OPENROUTER_API_KEY e, opcionalmente, OPENROUTER_HTTP_REFERER e OPENROUTER_X_TITLE.
 */
export async function openRouterChat(params: {
  system?: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const apiKey = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY não configurada');
  }
  process.env.OPENROUTER_API_KEY = apiKey;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (params.system?.trim()) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.user });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...openRouterExtraHeaders(),
  };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.model ?? getOpenRouterModel(),
      messages,
      max_tokens: params.max_tokens ?? 4096,
      temperature: params.temperature ?? 0.2,
    }),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error(`OpenRouter resposta inválida (${res.status}): ${rawText.slice(0, 400)}`);
  }

  if (!res.ok) {
    const detail = messageFromUnknownBody(data) ?? rawText.slice(0, 500);
    throw new Error(`OpenRouter ${res.status}: ${detail}`);
  }

  const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices;
  const content = choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    const t = content.trim();
    if (t) return t;
  }

  if (Array.isArray(content)) {
    const parts = content as Array<{ type?: string; text?: string }>;
    const joined = parts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .join('');
    const t = joined.trim();
    if (t) return t;
  }

  throw new Error('Resposta vazia do OpenRouter');
}

export async function openRouterChatByTask(
  task: OpenRouterTask,
  params: {
    system?: string;
    user: string;
    max_tokens?: number;
    temperature?: number;
  }
): Promise<string> {
  return openRouterChat({
    ...params,
    model: getOpenRouterModelForTask(task),
  });
}

/** Modelo só para geração de imagem (ex.: google/gemini-2.5-flash-image). Ver OPENROUTER_MODEL_IMAGE. */
export function getOpenRouterImageModel(): string | null {
  return process.env.OPENROUTER_MODEL_IMAGE?.trim() || null;
}

type OpenRouterImagePart = {
  image_url?: { url?: string };
  imageUrl?: { url?: string };
  type?: string;
};

/** Extrai data URL / URL http da mensagem assistant (images[] ou content multimodal). */
export function extractImageUrlFromOpenRouterMessage(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null;

  const images = message.images as OpenRouterImagePart[] | undefined;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    const url =
      first?.image_url?.url ??
      first?.imageUrl?.url ??
      (typeof (first as { url?: string })?.url === 'string' ? (first as { url: string }).url : undefined);
    if (typeof url === 'string' && (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
  }

  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const p = part as Record<string, unknown>;
      const t = String(p.type || '').toLowerCase();
      if (t === 'image_url') {
        const iu = p.image_url ?? p.imageUrl;
        if (iu && typeof iu === 'object') {
          const url = (iu as { url?: string }).url;
          if (typeof url === 'string' && (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'))) {
            return url;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Gera imagem via OpenRouter (chat/completions + modalities).
 * Retorna data URL (data:image/...;base64,...) ou null.
 */
export async function openRouterGenerateImage(prompt: string): Promise<string | null> {
  const model = getOpenRouterImageModel();
  if (!model) return null;

  const apiKey = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);
  if (!apiKey) {
    console.warn('[openrouter-image] OPENROUTER_API_KEY ausente');
    return null;
  }
  process.env.OPENROUTER_API_KEY = apiKey;

  const didacticPrefix =
    'Professional clean educational illustration for a printed course handout (A4), clear composition, minimal overlaid text. ';
  const userContent = `${didacticPrefix}${prompt.trim()}`.slice(0, 8000);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...openRouterExtraHeaders(),
  };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: userContent }],
      modalities: ['image', 'text'],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    console.error('[openrouter-image] JSON inválido:', rawText.slice(0, 400));
    return null;
  }

  if (!res.ok) {
    const detail = messageFromUnknownBody(data) ?? rawText.slice(0, 400);
    console.error('[openrouter-image]', res.status, detail);
    return null;
  }

  const message = (data as { choices?: Array<{ message?: Record<string, unknown> }> })?.choices?.[0]?.message;
  if (!message) return null;

  const extracted = extractImageUrlFromOpenRouterMessage(message);
  if (extracted) return extracted;

  console.warn(
    '[openrouter-image] Sem imagem na resposta (sem message.images nem content[].image_url). message keys:',
    Object.keys(message).join(', ')
  );
  return null;
}
