import { normalizeOpenRouterApiKey, syncOpenRouterKeyFromEnvAliases } from '@/lib/openrouter-key';
import { buildImagePrompt, type ImageAspectRatio } from '@/lib/image-prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY_INFO_URL = 'https://openrouter.ai/api/v1/key';

/** Referer padrão quando OPENROUTER_HTTP_REFERER não está definido (HTTPS costuma ser mais seguro com gateways). */
function defaultOpenRouterReferer(): string {
  const explicit = process.env.OPENROUTER_HTTP_REFERER?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch {
      /* ignora valor inválido */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  return 'https://127.0.0.1:3000';
}

function openRouterExtraHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  h['HTTP-Referer'] = defaultOpenRouterReferer();
  const title = process.env.OPENROUTER_X_TITLE?.trim() || 'scribo';
  h['X-OpenRouter-Title'] = title;
  return h;
}

export type OpenRouterKeyVerifyResult =
  | { ok: true; label?: string; limitRemaining?: number | null }
  | { ok: false; message: string };

function parseOpenRouterKeyErrorBody(raw: string): string {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } };
    const m = j.error?.message;
    if (typeof m === 'string' && m.length > 0) return m;
  } catch {
    /* ignore */
  }
  return raw.slice(0, 280).trim();
}

type OpenRouterKeyInfoPayload = {
  data?: {
    label?: string;
    limit_remaining?: number | null;
    is_management_key?: boolean;
  };
};

/**
 * Valida a chave com GET /api/v1/key (documentação OpenRouter).
 * Chaves de Management API não servem para chat/completions — detectamos antes de gastar tokens.
 */
export async function verifyOpenRouterApiKeyForCompletions(rawKey: string): Promise<OpenRouterKeyVerifyResult> {
  const apiKey = normalizeOpenRouterApiKey(rawKey);
  if (!apiKey) {
    return { ok: false, message: 'OPENROUTER_API_KEY está vazia.' };
  }

  const res = await fetch(OPENROUTER_KEY_INFO_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });

  const rawText = await res.text();

  if (!res.ok) {
    const detail = parseOpenRouterKeyErrorBody(rawText);
    if (res.status === 401) {
      return {
        ok: false,
        message: `OpenRouter recusou esta chave (401: ${detail}). Use uma chave criada em https://openrouter.ai/keys (API key para uso em apps — não a chave de Management em /settings/management-keys). Verifique créditos e crie uma chave nova se precisar.`,
      };
    }
    return {
      ok: false,
      message: `OpenRouter rejeitou a verificação da chave (${res.status}): ${detail}`,
    };
  }

  let payload: OpenRouterKeyInfoPayload;
  try {
    payload = JSON.parse(rawText) as OpenRouterKeyInfoPayload;
  } catch {
    return { ok: true };
  }

  const d = payload.data;
  if (d?.is_management_key) {
    return {
      ok: false,
      message:
        'Esta chave é de Management API (só para administrar outras chaves). Para gerar material, crie uma chave de API normal em https://openrouter.ai/keys (não em Management keys).',
    };
  }

  return {
    ok: true,
    label: typeof d?.label === 'string' ? d.label : undefined,
    limitRemaining: d?.limit_remaining ?? undefined,
  };
}

/** Claude Sonnet 4 (Anthropic via OpenRouter) — referência; uso premium se configurado no .env. */
export const OPENROUTER_MODEL_CLAUDE_SONNET_4 = 'anthropic/claude-sonnet-4';

/** GPT-4o (OpenAI via OpenRouter) — referência premium. */
export const OPENROUTER_MODEL_GPT_4O = 'openai/gpt-4o';

/**
 * Modelos padrão do OpenRouter.
 * Sobrescreva com OPENROUTER_MODEL_TEXT_MATERIAL / OPENROUTER_MODEL_DESIGN no .env.local.
 */
export const OPENROUTER_MODELS = {
  /**
   * Sonnet 4.5 — melhor voz/ritmo, evita clichês de IA. Usado pros prompts editoriais
   * de material completo/resumido. Override com OPENROUTER_MODEL_TEXT_MATERIAL pra testar 4.6.
   */
  textMaterial: 'anthropic/claude-sonnet-4.5',
  design: 'anthropic/claude-3.5-haiku',
} as const;

/**
 * Cadeia de fallback para quando o modelo principal falha por saldo/créditos (402).
 * Tenta cada modelo na ordem até um funcionar.
 */
export const OPENROUTER_FALLBACK_MODELS = [
  'openai/gpt-4o-mini',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
] as const;

/** @deprecated Use OPENROUTER_FALLBACK_MODELS[0] */
export const OPENROUTER_FALLBACK_CHAT_MODEL = OPENROUTER_FALLBACK_MODELS[0];

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

/** Erro HTTP do OpenRouter por saldo/créditos — vale tentar modelo mais barato. */
function looksLikeInsufficientCredits(status: number, detail: string): boolean {
  if (status === 402) return true;
  const l = detail.toLowerCase();
  return (
    l.includes('insufficient') ||
    l.includes('credit balance') ||
    l.includes('balance too low') ||
    l.includes('payment required') ||
    l.includes('not enough credits') ||
    (l.includes('quota') && l.includes('exceeded'))
  );
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

type OpenRouterChatParams = {
  system?: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
};

async function openRouterChatWithModel(model: string, params: OpenRouterChatParams): Promise<string> {
  syncOpenRouterKeyFromEnvAliases();
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
      model,
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

/**
 * Chamada à API Chat Completions do OpenRouter (compatível com OpenAI).
 * Se o modelo configurado falhar por saldo insuficiente, percorre a cadeia de fallback
 * (`OPENROUTER_FALLBACK_MODELS`) até encontrar um que funcione.
 */
export async function openRouterChat(params: OpenRouterChatParams): Promise<string> {
  const primaryModel = params.model ?? getOpenRouterModel();
  const tried = new Set<string>([primaryModel]);

  let lastErr: Error | null = null;

  // Tenta o modelo principal
  try {
    return await openRouterChatWithModel(primaryModel, params);
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    lastErr = err;
    const msg = err.message;
    const m = msg.match(/^OpenRouter (\d+):\s*([\s\S]*)$/);
    const status = m ? parseInt(m[1], 10) : 0;
    const detail = m ? m[2] : msg;
    if (!looksLikeInsufficientCredits(status, detail)) throw err;
    console.warn(`[openrouter] Modelo "${primaryModel}" sem créditos (${status}); tentando fallbacks...`);
  }

  // Percorre cadeia de fallback
  for (const fallback of OPENROUTER_FALLBACK_MODELS) {
    if (tried.has(fallback)) continue;
    tried.add(fallback);
    try {
      console.warn(`[openrouter] Tentando fallback "${fallback}"...`);
      return await openRouterChatWithModel(fallback, params);
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      lastErr = err;
      const msg = err.message;
      const m = msg.match(/^OpenRouter (\d+):\s*([\s\S]*)$/);
      const status = m ? parseInt(m[1], 10) : 0;
      const detail = m ? m[2] : msg;
      if (!looksLikeInsufficientCredits(status, detail)) {
        // Erro diferente de crédito (ex.: rate limit) — tenta o próximo
        console.warn(`[openrouter] Fallback "${fallback}" falhou (${status}): ${detail.slice(0, 120)}`);
        continue;
      }
      console.warn(`[openrouter] Fallback "${fallback}" também sem créditos.`);
    }
  }

  throw lastErr ?? new Error('Todos os modelos falharam no OpenRouter.');
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

/**
 * Modelo Nano Banana (imagem) no OpenRouter — Gemini Flash Image.
 * Sobrescreva com OPENROUTER_MODEL_IMAGE se o provedor mudar o slug.
 */
export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'google/gemini-2.5-flash-image';

/** Modelo só para geração de imagem via OpenRouter (modalities image + text). */
export function getOpenRouterImageModel(): string {
  return process.env.OPENROUTER_MODEL_IMAGE?.trim() || DEFAULT_OPENROUTER_IMAGE_MODEL;
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
 *
 * Aceita aspect ratio (wide | portrait | square) — o hint é injetado no prompt
 * junto do prefixo didático (estilo flexível + texto em PT-BR).
 */
export async function openRouterGenerateImage(
  prompt: string,
  ratio: ImageAspectRatio = 'wide',
): Promise<string | null> {
  const model = getOpenRouterImageModel();

  syncOpenRouterKeyFromEnvAliases();
  const apiKey = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);
  if (!apiKey) {
    console.warn('[openrouter-image] OPENROUTER_API_KEY ausente');
    return null;
  }
  process.env.OPENROUTER_API_KEY = apiKey;

  const userContent = buildImagePrompt(prompt, ratio);

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
