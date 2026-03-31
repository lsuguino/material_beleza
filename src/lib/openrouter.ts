const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const OPENROUTER_MODELS = {
  textMaterial: 'openai/gpt-4o',
  design: 'anthropic/claude-sonnet-4',
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
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY não configurada');
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (params.system?.trim()) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.user });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  if (referer) headers['HTTP-Referer'] = referer;
  const title = process.env.OPENROUTER_X_TITLE?.trim();
  if (title) headers['X-Title'] = title;

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
